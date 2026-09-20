import { describe, it, expect, beforeAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  signUpCustomer,
  signUpDesigner,
  myDesignerId,
  createAdmin,
  settleDesignPayment,
  uniqueEmail,
  PASSWORD,
  freshClient,
} from './helpers';

/*
  The designer marketplace, exercised the way the browser does it: anon key
  only, RLS on, no service-role shortcuts except the two the browser genuinely
  cannot perform (provisioning an admin, and settling a payment as the webhook
  does — see helpers.ts).

  The rule this suite exists to prove is the one the whole product claim rests
  on: a designer who has not been approved by a human is inert, and a designer
  who was not selected keeps no access to anything. If either of those is
  wrong, "vetted by print professionals" is not true.

  Storage object policies (designer-portfolio / design-briefs /
  design-deliverables buckets) are deliberately out of scope here — these tests
  drive submit_design_deliverable() with a synthetic path, which is what
  determines the order state machine. The bucket policies are a separate
  concern and would need real file uploads to exercise honestly.
*/

describe('PrintAir designer marketplace loop', () => {
  let customer: SupabaseClient;
  let designerA: SupabaseClient;
  let designerB: SupabaseClient;
  let outsider: SupabaseClient;
  let admin: SupabaseClient;

  let customerId: string;
  let designerAId: string;
  let designerBId: string;
  let outsiderId: string;
  let requestId: string;
  let proposalAId: string;
  let proposalBId: string;
  let orderId: string;
  let deliverableId: string;

  beforeAll(async () => {
    admin = await createAdmin();

    customer = await signUpCustomer({
      email: uniqueEmail('design-customer'),
      firstName: 'Mika',
      lastName: 'Delgado',
      mobile: '0917 555 0120',
    });
    customerId = (await customer.auth.getUser()).data.user!.id;

    designerA = await signUpDesigner({
      email: uniqueEmail('designer-a'),
      displayName: 'Ivy Castillo',
      city: 'Quezon City',
      specialties: ['packaging', 'label'],
      bio: 'Packaging and label design for food brands.',
    });
    designerAId = await myDesignerId(designerA);

    designerB = await signUpDesigner({
      email: uniqueEmail('designer-b'),
      displayName: 'Noel Bautista',
      city: 'Cebu City',
      specialties: ['packaging', 'logo'],
    });
    designerBId = await myDesignerId(designerB);

    // Matches no specialty this suite uses — must stay blind throughout.
    outsider = await signUpDesigner({
      email: uniqueEmail('designer-outsider'),
      displayName: 'Rea Villanueva',
      city: 'Davao City',
      specialties: ['product-graphics'],
    });
    outsiderId = await myDesignerId(outsider);
  });

  // -------------------------------------------------------------------------
  // Signup and the approval gate
  // -------------------------------------------------------------------------

  it('opens a designer signup as an application, not a live account', async () => {
    const { data: profile } = await designerA.from('profiles').select('role').eq('id', (await designerA.auth.getUser()).data.user!.id).single();
    expect(profile?.role).toBe('designer');

    const { data: dp } = await designerA.from('designer_profiles').select('*').eq('id', designerAId).single();
    expect(dp?.display_name).toBe('Ivy Castillo');
    // The whole vetting model depends on this default.
    expect(dp?.status).toBe('pending_review');

    const { data: specs } = await designerA
      .from('designer_specialties')
      .select('specialty')
      .eq('designer_id', designerAId);
    expect(specs?.map((s) => s.specialty).sort()).toEqual(['label', 'packaging']);
  });

  it('hides an unapproved designer from the public directory', async () => {
    const anon = freshClient();
    const { data } = await anon.from('designer_directory').select('id').eq('id', designerAId);
    expect(data ?? []).toHaveLength(0);
  });

  it('refuses to let a designer approve themselves', async () => {
    const { error } = await designerA
      .from('designer_profiles')
      .update({ status: 'active' })
      .eq('id', designerAId);
    expect(error).toBeTruthy();

    const { data } = await designerA.from('designer_profiles').select('status').eq('id', designerAId).single();
    expect(data?.status).toBe('pending_review');
  });

  it('starts a pending designer with an empty job board', async () => {
    // Weak on its own — nothing has been submitted yet. The real proof that
    // the approval gate holds against a live fan-out is in the security
    // regression suite below.
    const { data } = await designerA.from('design_opportunities').select('id').eq('designer_id', designerAId);
    expect(data ?? []).toHaveLength(0);
  });

  it('lets an admin approve an application, which publishes the designer', async () => {
    const { error } = await admin.rpc('admin_review_designer', {
      p_designer_id: designerAId,
      p_decision: 'active',
      p_reason: 'Portfolio shows correct bleed and CMYK output.',
    });
    expect(error).toBeNull();

    await admin.rpc('admin_review_designer', {
      p_designer_id: designerBId,
      p_decision: 'active',
      p_reason: 'Strong packaging samples.',
    });
    await admin.rpc('admin_review_designer', {
      p_designer_id: outsiderId,
      p_decision: 'active',
      p_reason: 'Approved, different specialty.',
    });

    const { data: dp } = await designerA.from('designer_profiles').select('status, review_reason').eq('id', designerAId).single();
    expect(dp?.status).toBe('active');
    expect(dp?.review_reason).toContain('bleed');

    const anon = freshClient();
    const { data: listed } = await anon.from('designer_directory').select('id, display_name').eq('id', designerAId).single();
    expect(listed?.display_name).toBe('Ivy Castillo');
  });

  it('refuses a second decision on an already-decided application', async () => {
    const { error } = await admin.rpc('admin_review_designer', {
      p_designer_id: designerAId,
      p_decision: 'rejected',
      p_reason: 'Changed my mind.',
    });
    expect(error).toBeTruthy();
  });

  it('blocks a non-admin from approving anyone', async () => {
    const { error } = await customer.rpc('admin_review_designer', {
      p_designer_id: designerBId,
      p_decision: 'active',
      p_reason: 'I would like a designer please.',
    });
    expect(error).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Request -> fan-out
  // -------------------------------------------------------------------------

  it('creates and submits a design request, fanning it out by specialty only', async () => {
    const { data: created, error } = await customer
      .from('design_requests')
      .insert({
        customer_id: customerId,
        title: 'Packaging for a pili nut brand',
        specialty: 'packaging',
        description: 'Kraft carton for a 200g pili nut pouch, warm and artisanal.',
        budget_min: 6000,
        budget_max: 14000,
      })
      .select()
      .single();
    expect(error).toBeNull();
    requestId = created!.id;
    expect(created!.status).toBe('DRAFT');

    // A draft must not reach anyone yet.
    const { data: early } = await designerA.from('design_opportunities').select('id').eq('request_id', requestId);
    expect(early ?? []).toHaveLength(0);

    const { error: submitErr } = await customer.rpc('submit_design_request', { p_request_id: requestId });
    expect(submitErr).toBeNull();

    const { data: after } = await customer.from('design_requests').select('status').eq('id', requestId).single();
    expect(after?.status).toBe('OPEN_FOR_PROPOSALS');

    const { data: oppA } = await designerA.from('design_opportunities').select('id, status').eq('request_id', requestId);
    expect(oppA).toHaveLength(1);
    expect(oppA![0].status).toBe('NEW');

    const { data: oppB } = await designerB.from('design_opportunities').select('id').eq('request_id', requestId);
    expect(oppB).toHaveLength(1);

    // Different specialty — never matched.
    const { data: oppOut } = await outsider.from('design_opportunities').select('id').eq('request_id', requestId);
    expect(oppOut ?? []).toHaveLength(0);
  });

  it('keeps the brief unreadable to a designer who was not matched', async () => {
    const { data } = await outsider.from('design_requests').select('id').eq('id', requestId);
    expect(data ?? []).toHaveLength(0);
  });

  it('refuses a submission with no description', async () => {
    const { data: bare } = await customer
      .from('design_requests')
      .insert({ customer_id: customerId, title: 'Empty brief', specialty: 'logo' })
      .select()
      .single();
    const { error } = await customer.rpc('submit_design_request', { p_request_id: bare!.id });
    expect(error).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Proposals
  // -------------------------------------------------------------------------

  it('lets each matched designer propose independently', async () => {
    const { data: a, error: aErr } = await designerA
      .from('design_proposals')
      .insert({ request_id: requestId, designer_id: designerAId, status: 'DRAFT' })
      .select()
      .single();
    expect(aErr).toBeNull();
    proposalAId = a!.id;

    await designerA
      .from('design_proposals')
      .update({ price: 9500, down_payment_pct: 50, turnaround_days: 7, revision_rounds_included: 2, note: 'Includes dieline.' })
      .eq('id', proposalAId);
    const { error: submitA } = await designerA.rpc('submit_design_proposal', { p_proposal_id: proposalAId });
    expect(submitA).toBeNull();

    const { data: b } = await designerB
      .from('design_proposals')
      .insert({ request_id: requestId, designer_id: designerBId, status: 'DRAFT' })
      .select()
      .single();
    proposalBId = b!.id;
    await designerB
      .from('design_proposals')
      .update({ price: 12000, down_payment_pct: 30, turnaround_days: 5, revision_rounds_included: 3 })
      .eq('id', proposalBId);
    await designerB.rpc('submit_design_proposal', { p_proposal_id: proposalBId });

    // Submitting flips the opportunity so the job board reflects reality.
    const { data: opp } = await designerA
      .from('design_opportunities')
      .select('status')
      .eq('request_id', requestId)
      .eq('designer_id', designerAId)
      .single();
    expect(opp?.status).toBe('PROPOSED');
  });

  it('refuses to submit an incomplete proposal', async () => {
    const anotherRequest = await customer
      .from('design_requests')
      .insert({
        customer_id: customerId,
        title: 'Logo for a coffee cart',
        specialty: 'logo',
        description: 'Simple wordmark.',
      })
      .select()
      .single();
    await customer.rpc('submit_design_request', { p_request_id: anotherRequest.data!.id });

    const { data: draft } = await designerB
      .from('design_proposals')
      .insert({ request_id: anotherRequest.data!.id, designer_id: designerBId, status: 'DRAFT' })
      .select()
      .single();
    // No price / turnaround / down payment set.
    const { error } = await designerB.rpc('submit_design_proposal', { p_proposal_id: draft!.id });
    expect(error).toBeTruthy();
  });

  it('hides each proposal from the competing designer', async () => {
    const { data: seenByB } = await designerB.from('design_proposals').select('id').eq('id', proposalAId);
    expect(seenByB ?? []).toHaveLength(0);

    const { data: seenByA } = await designerA.from('design_proposals').select('id').eq('id', proposalBId);
    expect(seenByA ?? []).toHaveLength(0);
  });

  it('shows the customer both proposals, with no winner marked', async () => {
    const { data } = await customer.from('design_proposals').select('id, status, price').eq('request_id', requestId);
    expect(data).toHaveLength(2);
    expect(data!.every((p) => p.status === 'SUBMITTED')).toBe(true);
  });

  it('enforces one active proposal per designer per request', async () => {
    const { error } = await designerA
      .from('design_proposals')
      .insert({ request_id: requestId, designer_id: designerAId, status: 'DRAFT' });
    expect(error).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Selection and payment
  // -------------------------------------------------------------------------

  it('opens exactly one order at AWAITING_PAYMENT with a 5% platform fee', async () => {
    const { error } = await customer.rpc('select_design_proposal', { p_proposal_id: proposalAId });
    expect(error).toBeNull();

    const { data: orders } = await customer.from('design_orders').select('*').eq('request_id', requestId);
    expect(orders).toHaveLength(1);
    orderId = orders![0].id;
    expect(orders![0].status).toBe('AWAITING_PAYMENT');
    expect(orders![0].designer_id).toBe(designerAId);

    const { data: payment } = await customer.from('design_payments').select('amount, status').eq('order_id', orderId).single();
    expect(payment?.status).toBe('pending');
    // 5% of 9500.
    expect(Number(payment?.amount)).toBeCloseTo(475, 2);

    const { data: req } = await customer.from('design_requests').select('status, selected_proposal_id').eq('id', requestId).single();
    expect(req?.status).toBe('DESIGNER_SELECTED');
    expect(req?.selected_proposal_id).toBe(proposalAId);
  });

  it('closes the losing proposal and cuts off that designer entirely', async () => {
    const { data: lost } = await designerB.from('design_proposals').select('status').eq('id', proposalBId).single();
    expect(lost?.status).toBe('NOT_SELECTED');

    const { data: order } = await designerB.from('design_orders').select('id').eq('id', orderId);
    expect(order ?? []).toHaveLength(0);
  });

  it('refuses a second selection on the same request', async () => {
    const { error } = await customer.rpc('select_design_proposal', { p_proposal_id: proposalBId });
    expect(error).toBeTruthy();
  });

  it('will not accept a deliverable before the platform fee is settled', async () => {
    const { error } = await designerA.rpc('submit_design_deliverable', {
      p_order_id: orderId,
      p_storage_path: `${orderId}/premature.pdf`,
      p_file_name: 'premature.pdf',
    });
    expect(error).toBeTruthy();
  });

  it('gives the client no way to mark its own payment paid', async () => {
    const { error } = await customer.from('design_payments').update({ status: 'paid' }).eq('order_id', orderId);
    // No UPDATE grant on design_payments for authenticated — the webhook alone settles it.
    expect(error).toBeTruthy();

    const { data } = await customer.from('design_payments').select('status').eq('order_id', orderId).single();
    expect(data?.status).toBe('pending');
  });

  // -------------------------------------------------------------------------
  // Deliverables and the revision loop
  // -------------------------------------------------------------------------

  it('moves the order to IN_PROGRESS on the first deliverable', async () => {
    await settleDesignPayment(orderId);

    const { data: confirmed } = await customer.from('design_orders').select('status').eq('id', orderId).single();
    expect(confirmed?.status).toBe('CONFIRMED');

    const { data, error } = await designerA
      .rpc('submit_design_deliverable', {
        p_order_id: orderId,
        p_storage_path: `${orderId}/rev1-carton.pdf`,
        p_file_name: 'rev1-carton.pdf',
        p_mime_type: 'application/pdf',
      })
      .single();
    expect(error).toBeNull();
    deliverableId = (data as { id: string }).id;
    expect((data as { revision_number: number }).revision_number).toBe(1);

    const { data: order } = await designerA.from('design_orders').select('status').eq('id', orderId).single();
    expect(order?.status).toBe('IN_PROGRESS');
  });

  it('numbers the next revision server-side, and lets only the customer review it', async () => {
    const { error } = await designerA.rpc('review_design_deliverable', {
      p_deliverable_id: deliverableId,
      p_approved: true,
    });
    // The designer is not the customer — only the customer reviews.
    expect(error).toBeTruthy();

    const { error: feedbackErr } = await customer.rpc('review_design_deliverable', {
      p_deliverable_id: deliverableId,
      p_approved: false,
      p_feedback: 'Warmer kraft tone, and enlarge the logo on the front panel.',
    });
    expect(feedbackErr).toBeNull();

    const { data: second } = await designerA
      .rpc('submit_design_deliverable', {
        p_order_id: orderId,
        p_storage_path: `${orderId}/rev2-carton.pdf`,
        p_file_name: 'rev2-carton.pdf',
      })
      .single();
    expect((second as { revision_number: number }).revision_number).toBe(2);

    const { data: order } = await customer.from('design_orders').select('status').eq('id', orderId).single();
    expect(order?.status).toBe('IN_PROGRESS');
  });

  it('requires feedback when sending a revision back', async () => {
    const { data: latest } = await customer
      .from('design_deliverables')
      .select('id')
      .eq('order_id', orderId)
      .eq('revision_number', 2)
      .single();

    const { error } = await customer.rpc('review_design_deliverable', {
      p_deliverable_id: latest!.id,
      p_approved: false,
    });
    expect(error).toBeTruthy();
  });

  it('denies a non-selected designer any sight of the deliverables', async () => {
    const { data } = await designerB.from('design_deliverables').select('id').eq('order_id', orderId);
    expect(data ?? []).toHaveLength(0);
  });

  it('closes the order when the customer approves a revision', async () => {
    const { data: latest } = await customer
      .from('design_deliverables')
      .select('id')
      .eq('order_id', orderId)
      .eq('revision_number', 2)
      .single();

    const { error } = await customer.rpc('review_design_deliverable', {
      p_deliverable_id: latest!.id,
      p_approved: true,
    });
    expect(error).toBeNull();

    const { data: order } = await customer.from('design_orders').select('status').eq('id', orderId).single();
    expect(order?.status).toBe('DELIVERED');

    const { data: req } = await customer.from('design_requests').select('status').eq('id', requestId).single();
    expect(req?.status).toBe('DELIVERED');
  });

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------

  it('accepts exactly one review, only from the customer, only after delivery', async () => {
    const { error: wrongPerson } = await designerA.rpc('create_design_review', {
      p_order_id: orderId,
      p_rating: 5,
      p_comment: 'I was great.',
      p_would_work_again: true,
    });
    expect(wrongPerson).toBeTruthy();

    const { error } = await customer.rpc('create_design_review', {
      p_order_id: orderId,
      p_rating: 5,
      p_comment: 'Understood the brief immediately and the dieline was print-ready.',
      p_would_work_again: true,
    });
    expect(error).toBeNull();

    const { error: twice } = await customer.rpc('create_design_review', {
      p_order_id: orderId,
      p_rating: 1,
      p_would_work_again: false,
    });
    expect(twice).toBeTruthy();
  });

  it('surfaces the review and completed count on the public profile', async () => {
    const anon = freshClient();
    const { data } = await anon
      .from('designer_directory')
      .select('average_rating, review_count, completed_orders')
      .eq('id', designerAId)
      .single();
    expect(Number(data?.average_rating)).toBeCloseTo(5, 1);
    expect(Number(data?.review_count)).toBe(1);
    expect(Number(data?.completed_orders)).toBe(1);
  });

  it('does not let a designer edit or hide a review about them', async () => {
    const { data: review } = await customer.from('design_reviews').select('id').eq('order_id', orderId).single();

    const { error } = await designerA.from('design_reviews').update({ rating: 1 }).eq('id', review!.id);
    expect(error).toBeTruthy();

    const { error: rpcErr } = await designerA.rpc('admin_moderate_design_review', {
      p_review_id: review!.id,
      p_hidden: true,
      p_reason: 'I did not like it.',
    });
    expect(rpcErr).toBeTruthy();
  });

  it('lets an admin hide an abusive review', async () => {
    const { data: review } = await customer.from('design_reviews').select('id').eq('order_id', orderId).single();
    const { error } = await admin.rpc('admin_moderate_design_review', {
      p_review_id: review!.id,
      p_hidden: true,
      p_reason: 'Contains personal information.',
    });
    expect(error).toBeNull();

    const anon = freshClient();
    const { data: hidden } = await anon.from('design_reviews').select('id').eq('id', review!.id);
    expect(hidden ?? []).toHaveLength(0);

    // Restore so the aggregate assertions above stay meaningful for reruns.
    await admin.rpc('admin_moderate_design_review', {
      p_review_id: review!.id,
      p_hidden: false,
      p_reason: 'Reviewed, no personal information present.',
    });
  });
});

/*
  Security regressions specific to the designer half.

  Each mirrors an exploit class already found and fixed on the print side
  (20260806000100_critical_security_patch.sql), re-checked here because the
  designer tables are parallel implementations, not shared code — a fix on one
  side does not automatically hold on the other.
*/
describe('security regression — designer marketplace', () => {
  it('ignores a client-supplied designer status at signup', async () => {
    const client = freshClient();
    const email = uniqueEmail('presumptuous-designer');
    const { error } = await client.auth.signUp({
      email,
      password: PASSWORD,
      options: {
        data: {
          role: 'designer',
          display_name: 'Already Approved',
          city: 'Manila',
          specialties: ['logo'],
          // Not a field handle_new_user() reads — asserted so that stays true.
          status: 'active',
        },
      },
    });
    expect(error).toBeNull();

    const id = (await client.auth.getUser()).data.user!.id;
    const { data } = await client.from('designer_profiles').select('status').eq('user_id', id).single();
    expect(data?.status).toBe('pending_review');
  });

  it('blocks a designer from retargeting their opportunity onto another request (IDOR)', async () => {
    const admin = await createAdmin();

    const victim = await signUpCustomer({ email: uniqueEmail('d-idor-victim'), firstName: 'Vic', lastName: 'Tim' });
    const victimId = (await victim.auth.getUser()).data.user!.id;
    const owner = await signUpCustomer({ email: uniqueEmail('d-idor-owner'), firstName: 'Own', lastName: 'Er' });
    const ownerId = (await owner.auth.getUser()).data.user!.id;

    const designer = await signUpDesigner({
      email: uniqueEmail('d-idor-designer'),
      displayName: 'IDOR Tester',
      city: 'Manila',
      specialties: ['logo'],
    });
    const designerId = await myDesignerId(designer);
    await admin.rpc('admin_review_designer', {
      p_designer_id: designerId,
      p_decision: 'active',
      p_reason: 'Approved for test.',
    });

    // The request the designer is legitimately matched to.
    const { data: mine } = await owner
      .from('design_requests')
      .insert({ customer_id: ownerId, title: 'Legit logo', specialty: 'logo', description: 'A logo.' })
      .select()
      .single();
    await owner.rpc('submit_design_request', { p_request_id: mine!.id });

    // A request they must never see: different specialty, so no fan-out.
    const { data: secret } = await victim
      .from('design_requests')
      .insert({ customer_id: victimId, title: 'Confidential packaging', specialty: 'packaging', description: 'Secret.' })
      .select()
      .single();
    await victim.rpc('submit_design_request', { p_request_id: secret!.id });

    const { data: opp } = await designer
      .from('design_opportunities')
      .select('id')
      .eq('request_id', mine!.id)
      .eq('designer_id', designerId)
      .single();

    const { error } = await designer
      .from('design_opportunities')
      .update({ request_id: secret!.id })
      .eq('id', opp!.id);
    expect(error).toBeTruthy();

    // And the confidential brief stays unreadable.
    const { data: peek } = await designer.from('design_requests').select('id').eq('id', secret!.id);
    expect(peek ?? []).toHaveLength(0);
  });

  it('blocks a customer from flipping an opportunity status or asking on the designer’s behalf', async () => {
    const admin = await createAdmin();
    const customer = await signUpCustomer({ email: uniqueEmail('d-guard-customer'), firstName: 'Gu', lastName: 'Ard' });
    const customerId = (await customer.auth.getUser()).data.user!.id;

    const designer = await signUpDesigner({
      email: uniqueEmail('d-guard-designer'),
      displayName: 'Guard Tester',
      city: 'Manila',
      specialties: ['label'],
    });
    const designerId = await myDesignerId(designer);
    await admin.rpc('admin_review_designer', {
      p_designer_id: designerId,
      p_decision: 'active',
      p_reason: 'Approved for test.',
    });

    const { data: req } = await customer
      .from('design_requests')
      .insert({ customer_id: customerId, title: 'Label job', specialty: 'label', description: 'Labels.' })
      .select()
      .single();
    await customer.rpc('submit_design_request', { p_request_id: req!.id });

    // Scoped to this designer on purpose: other suites in this file approve
    // designers carrying the same specialty, so a bare request_id lookup
    // matches several rows and .single() returns null.
    const { data: opp, error: oppErr } = await customer
      .from('design_opportunities')
      .select('id')
      .eq('request_id', req!.id)
      .eq('designer_id', designerId)
      .single();
    expect(oppErr).toBeNull();
    expect(opp).toBeTruthy();

    const { error: statusErr } = await customer
      .from('design_opportunities')
      .update({ status: 'DECLINED' })
      .eq('id', opp!.id);
    expect(statusErr).toBeTruthy();

    const { error: questionErr } = await customer
      .from('design_opportunities')
      .update({ question: 'Pretending to be the designer' })
      .eq('id', opp!.id);
    expect(questionErr).toBeTruthy();

    // The customer's own column is allowed — this is the half that was missing
    // a UI, not a policy.
    const { error: answerErr } = await customer
      .from('design_opportunities')
      .update({ answer: 'Yes, matte finish please.' })
      .eq('id', opp!.id);
    expect(answerErr).toBeNull();
  });

  /*
    The load-bearing claim of the entire feature: an unapproved designer is
    inert. Asserted against a live fan-out rather than an empty starting state,
    because "no rows yet" passes trivially and would keep passing if
    distribute_design_opportunities() ever dropped its status check.
  */
  it('routes no work to a designer still awaiting review, even on a perfect specialty match', async () => {
    const admin = await createAdmin();
    const customer = await signUpCustomer({ email: uniqueEmail('gate-customer'), firstName: 'Ga', lastName: 'Te' });
    const customerId = (await customer.auth.getUser()).data.user!.id;

    // Same specialty, one approved and one left pending.
    const pending = await signUpDesigner({
      email: uniqueEmail('gate-pending'),
      displayName: 'Pending Pat',
      city: 'Manila',
      specialties: ['packaging'],
    });
    const pendingId = await myDesignerId(pending);

    const approved = await signUpDesigner({
      email: uniqueEmail('gate-approved'),
      displayName: 'Approved Ann',
      city: 'Manila',
      specialties: ['packaging'],
    });
    const approvedId = await myDesignerId(approved);
    await admin.rpc('admin_review_designer', {
      p_designer_id: approvedId,
      p_decision: 'active',
      p_reason: 'Approved for gate test.',
    });

    const { data: req } = await customer
      .from('design_requests')
      .insert({ customer_id: customerId, title: 'Carton work', specialty: 'packaging', description: 'A carton.' })
      .select()
      .single();
    await customer.rpc('submit_design_request', { p_request_id: req!.id });

    // The approved designer is matched...
    const { data: gotIt } = await approved
      .from('design_opportunities')
      .select('id')
      .eq('request_id', req!.id)
      .eq('designer_id', approvedId);
    expect(gotIt).toHaveLength(1);

    // ...and the pending one is not, despite matching the specialty exactly.
    const { data: didNot } = await pending
      .from('design_opportunities')
      .select('id')
      .eq('request_id', req!.id)
      .eq('designer_id', pendingId);
    expect(didNot ?? []).toHaveLength(0);

    // Nor can they read the brief by any other route.
    const { data: brief } = await pending.from('design_requests').select('id').eq('id', req!.id);
    expect(brief ?? []).toHaveLength(0);

    // Nor propose on it.
    const { error: proposeErr } = await pending
      .from('design_proposals')
      .insert({ request_id: req!.id, designer_id: pendingId, status: 'DRAFT' });
    expect(proposeErr).toBeTruthy();
  });

  it('keeps a suspended designer out of the matching pool', async () => {
    const admin = await createAdmin();
    const designer = await signUpDesigner({
      email: uniqueEmail('d-suspended'),
      displayName: 'Suspended Sam',
      city: 'Manila',
      specialties: ['product-graphics'],
    });
    const designerId = await myDesignerId(designer);
    const userId = (await designer.auth.getUser()).data.user!.id;

    await admin.rpc('admin_review_designer', {
      p_designer_id: designerId,
      p_decision: 'active',
      p_reason: 'Approved for test.',
    });

    // Suspending the account must cascade into designer_profiles — otherwise
    // distribute_design_opportunities() keeps routing work to them.
    const { error } = await admin.rpc('admin_set_account_status', {
      p_user_id: userId,
      p_status: 'suspended',
      p_reason: 'Test suspension.',
    });
    expect(error).toBeNull();

    const anon = freshClient();
    const { data: dp } = await anon.from('designer_profiles').select('status').eq('id', designerId).maybeSingle();
    // Not publicly visible any more; read it back as the admin instead.
    expect(dp).toBeNull();

    const { data: asAdmin } = await admin.from('designer_profiles').select('status').eq('id', designerId).single();
    expect(asAdmin?.status).toBe('suspended');

    const { data: listed } = await anon.from('designer_directory').select('id').eq('id', designerId);
    expect(listed ?? []).toHaveLength(0);
  });
});

/*
  Notification outbox coverage for the designer half
  (20260813000100_designer_notifications.sql).

  These assert the rows are written, not that email is sent — delivery is the
  dispatcher's job and is deliberately decoupled. A missing row here means a
  designer or customer is never told something happened, which is the failure
  mode the outbox exists to prevent.
*/
describe('designer marketplace notifications', () => {
  let admin: SupabaseClient;
  let customer: SupabaseClient;
  let designer: SupabaseClient;
  let designerId: string;
  let designerUserId: string;
  let customerId: string;

  beforeAll(async () => {
    admin = await createAdmin();
    customer = await signUpCustomer({ email: uniqueEmail('notif-customer'), firstName: 'Nina', lastName: 'Ocampo' });
    customerId = (await customer.auth.getUser()).data.user!.id;

    designer = await signUpDesigner({
      email: uniqueEmail('notif-designer'),
      displayName: 'Notify Tester',
      city: 'Manila',
      specialties: ['label'],
    });
    designerId = await myDesignerId(designer);
    designerUserId = (await designer.auth.getUser()).data.user!.id;
  });

  it('tells a designer their application was decided', async () => {
    await admin.rpc('admin_review_designer', {
      p_designer_id: designerId,
      p_decision: 'active',
      p_reason: 'Approved for notification test.',
    });

    const { data } = await designer
      .from('notifications')
      .select('kind, payload')
      .eq('recipient_id', designerUserId)
      .eq('kind', 'DESIGNER_APPLICATION_REVIEWED');
    expect(data).toHaveLength(1);
    expect((data![0].payload as { decision: string }).decision).toBe('active');
  });

  it('writes a notification at each step of the loop', async () => {
    const { data: req } = await customer
      .from('design_requests')
      .insert({ customer_id: customerId, title: 'Jar labels', specialty: 'label', description: 'Waterproof jar labels.' })
      .select()
      .single();
    await customer.rpc('submit_design_request', { p_request_id: req!.id });

    // 1. Designer told an opportunity arrived.
    const { data: oppNotif } = await designer
      .from('notifications')
      .select('payload')
      .eq('recipient_id', designerUserId)
      .eq('kind', 'DESIGN_OPPORTUNITY_RECEIVED');
    expect(oppNotif!.length).toBeGreaterThanOrEqual(1);

    const { data: proposal } = await designer
      .from('design_proposals')
      .insert({ request_id: req!.id, designer_id: designerId, status: 'DRAFT' })
      .select()
      .single();
    await designer
      .from('design_proposals')
      .update({ price: 4000, down_payment_pct: 50, turnaround_days: 4 })
      .eq('id', proposal!.id);
    await designer.rpc('submit_design_proposal', { p_proposal_id: proposal!.id });

    // 2. Customer told a proposal arrived.
    const { data: propNotif } = await customer
      .from('notifications')
      .select('payload')
      .eq('recipient_id', customerId)
      .eq('kind', 'DESIGN_PROPOSAL_RECEIVED');
    expect(propNotif!.length).toBeGreaterThanOrEqual(1);

    await customer.rpc('select_design_proposal', { p_proposal_id: proposal!.id });

    // 3. Designer told they won.
    const { data: selNotif } = await designer
      .from('notifications')
      .select('payload')
      .eq('recipient_id', designerUserId)
      .eq('kind', 'DESIGN_PROPOSAL_SELECTED');
    expect(selNotif!.length).toBeGreaterThanOrEqual(1);

    const { data: order } = await customer.from('design_orders').select('id').eq('request_id', req!.id).single();
    await settleDesignPayment(order!.id);

    // 4. Customer told the commission is confirmed.
    const { data: confirmNotif } = await customer
      .from('notifications')
      .select('payload')
      .eq('recipient_id', customerId)
      .eq('kind', 'DESIGN_ORDER_STATUS_CHANGED');
    expect(confirmNotif!.length).toBeGreaterThanOrEqual(1);

    const { data: deliverable } = await designer
      .rpc('submit_design_deliverable', {
        p_order_id: order!.id,
        p_storage_path: `${order!.id}/rev1.pdf`,
        p_file_name: 'rev1.pdf',
      })
      .single();

    // 5. Customer told a draft is ready.
    const { data: delivNotif } = await customer
      .from('notifications')
      .select('payload')
      .eq('recipient_id', customerId)
      .eq('kind', 'DESIGN_DELIVERABLE_SUBMITTED');
    expect(delivNotif!.length).toBeGreaterThanOrEqual(1);

    await customer.rpc('review_design_deliverable', {
      p_deliverable_id: (deliverable as { id: string }).id,
      p_approved: false,
      p_feedback: 'Please try a lighter background.',
    });

    // 6. Designer told changes were requested, with the feedback carried.
    const { data: revNotif } = await designer
      .from('notifications')
      .select('payload')
      .eq('recipient_id', designerUserId)
      .eq('kind', 'DESIGN_REVISION_REQUESTED');
    expect(revNotif!.length).toBeGreaterThanOrEqual(1);
    expect((revNotif![0].payload as { feedback: string }).feedback).toContain('lighter background');
  });

  it('never shows one account another account’s notifications', async () => {
    const { data } = await designer.from('notifications').select('recipient_id');
    expect((data ?? []).every((n) => n.recipient_id === designerUserId)).toBe(true);

    const { data: asCustomer } = await customer.from('notifications').select('recipient_id');
    expect((asCustomer ?? []).every((n) => n.recipient_id === customerId)).toBe(true);
  });

  it('gives a client no way to forge a notification', async () => {
    const { error } = await customer.from('notifications').insert({
      recipient_id: customerId,
      kind: 'DESIGN_PROPOSAL_RECEIVED',
      payload: { request_title: 'Fake' },
    });
    expect(error).toBeTruthy();
  });
});
