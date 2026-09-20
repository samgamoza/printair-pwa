// Seed realistic Philippine demo data for local development.
//
// Everything here goes through the SAME signup/action functions the browser
// uses (auth.signUp, insert/update through RLS, the RPCs) — never a raw
// service-role insert into profiles/projects/quotes. The only service-role
// use is creating the one admin account, which has no public signup path by
// design. This script proves the real flows work, it doesn't bypass them.
//
// Usage: node scripts/seed.mjs   (requires `npx supabase start` to be running)

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import zlib from 'node:zlib';

config();

const URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing env. Run `npx supabase start` and check .env.');
  process.exit(1);
}

// This script creates real accounts sharing one hardcoded, publicly-visible
// password. It must never run against anything but a local Supabase stack.
const isLocalTarget = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(URL);
if (!isLocalTarget && !process.argv.includes('--yes-production')) {
  console.error(
    `Refusing to seed ${URL} — it doesn't look like a local Supabase instance.\n` +
      'This script creates real accounts with a shared, hardcoded password.\n' +
      'Pass --yes-production if you really mean to run this against that target.',
  );
  process.exit(1);
}

const PASSWORD = 'PrintAir!2026';

function freshClient() {
  return createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

const serviceClient = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

async function signUp(client, email, password, data) {
  const { error } = await client.auth.signUp({ email, password, options: { data } });
  if (error) throw new Error(`signUp(${email}) failed: ${error.message}`);
}

async function signIn(email, password) {
  const client = freshClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  return client;
}

async function myPartnerId(client) {
  const { data: user } = await client.auth.getUser();
  const { data, error } = await client.from('partner_profiles').select('id').eq('user_id', user.user.id).single();
  if (error) throw error;
  return data.id;
}

async function myUserId(client) {
  const { data } = await client.auth.getUser();
  return data.user.id;
}

async function myDesignerId(client) {
  const { data: user } = await client.auth.getUser();
  const { data, error } = await client.from('designer_profiles').select('id').eq('user_id', user.user.id).single();
  if (error) throw error;
  return data.id;
}

/* ---------------------------------------------------------------------------
   Placeholder artwork.

   Portfolios and deliverables are the whole point of the designer half — a
   demo where every sample is a broken image tells the wrong story. Rather
   than commit binary fixtures to the repo, this synthesises real PNGs at seed
   time: a two-tone gradient with an offset block, which reads as a design
   mockup at thumbnail size.

   Dimensions matter beyond looks. designer_admin_review_queue flags a sample
   when width_px < 800 AND height_px < 800, so approved designers get 1000x750
   (clean) and the pending applicant gets 400x300 (flagged) — which is what
   makes the admin review queue worth looking at in a demo.
   --------------------------------------------------------------------------- */

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function makePng(width, height, [r0, g0, b0], [r1, g1, b1]) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const t = (x / width) * 0.6 + (y / height) * 0.4;
      // An offset block over the gradient, so thumbnails read as artwork
      // rather than as a colour swatch.
      const inBlock = x > width * 0.18 && x < width * 0.62 && y > height * 0.24 && y < height * 0.7;
      const k = inBlock ? 0.82 : 1;
      raw[o++] = Math.round((r0 + (r1 - r0) * t) * k);
      raw[o++] = Math.round((g0 + (g1 - g0) * t) * k);
      raw[o++] = Math.round((b0 + (b1 - b0) * t) * k);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  console.log('Seeding PrintAir demo data...\n');

  // --- Admin (operator-provisioned, no public signup path) ------------------
  const adminEmail = 'admin@printair.ph';
  const { data: existingAdmin } = await serviceClient.rpc('email_exists', { p_email: adminEmail });
  if (!existingAdmin) {
    const { error } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: PASSWORD,
      email_confirm: true,
      // 'admin' must come from app_metadata — handle_new_user() only trusts
      // an admin role from there, since it's the one field a public
      // auth.signUp() call can never set (service-role Admin API only).
      app_metadata: { role: 'admin' },
      user_metadata: { full_name: 'PrintAir Admin' },
    });
    if (error) throw new Error(`admin create failed: ${error.message}`);
    console.log(`Admin        admin@printair.ph / ${PASSWORD}`);
  } else {
    console.log('Admin        already exists, skipping');
  }

  // --- Customers --------------------------------------------------------------
  const customers = [
    { email: 'liza@sweetnookbakery.ph', first: 'Liza', last: 'Ramos', mobile: '0917 555 0101', label: 'Sweet Nook Bakery owner' },
    { email: 'carlo@brewbloom.ph', first: 'Carlo', last: 'Santos', mobile: '0917 555 0102', label: 'Brew & Bloom Café owner' },
    { email: 'ana@luminousbeauty.ph', first: 'Ana', last: 'Reyes', mobile: '0917 555 0103', label: 'Luminous Beauty founder' },
  ];
  for (const c of customers) {
    const { data: exists } = await serviceClient.rpc('email_exists', { p_email: c.email });
    if (exists) {
      console.log(`Customer     ${c.email} already exists, skipping`);
      continue;
    }
    await signUp(freshClient(), c.email, PASSWORD, {
      role: 'customer',
      first_name: c.first,
      last_name: c.last,
      mobile: c.mobile,
    });
    console.log(`Customer     ${c.email} / ${PASSWORD}  (${c.label})`);
  }

  // --- Printing partners --------------------------------------------------------
  const partners = [
    {
      email: 'ramon@cebupackaging.ph',
      contact: 'Ramon Cruz',
      business: 'Cebu Packaging Solutions',
      city: 'Mandaue City, Cebu',
      categories: ['product', 'food', 'bakery', 'retail'],
      services: ['Corrugated Boxes', 'Folding Cartons', 'Die-Cutting'],
      label: 'packaging printer',
    },
    {
      email: 'grace@manilaprint.ph',
      contact: 'Grace Lim',
      business: 'Manila Digital Print Co.',
      city: 'Quezon City, Metro Manila',
      categories: ['coffee', 'labels', 'marketing', 'corporate', 'bakery'],
      services: ['Digital Printing', 'Labels', 'Short-Run Packaging'],
      label: 'digital print shop',
    },
    {
      email: 'ben@luzonlargeformat.ph',
      contact: 'Ben Uy',
      business: 'Luzon Large Format Co.',
      city: 'Pasig City, Metro Manila',
      categories: ['marketing', 'corporate', 'retail', 'labels'],
      services: ['Large Format', 'Banners', 'Signage'],
      label: 'large-format provider',
    },
  ];
  for (const p of partners) {
    const { data: exists } = await serviceClient.rpc('email_exists', { p_email: p.email });
    if (exists) {
      console.log(`Partner      ${p.email} already exists, skipping`);
      continue;
    }
    await signUp(freshClient(), p.email, PASSWORD, {
      role: 'partner',
      contact_name: p.contact,
      business_name: p.business,
      city: p.city,
      categories: p.categories,
      services: p.services,
    });
    console.log(`Partner      ${p.email} / ${PASSWORD}  (${p.business}, ${p.label})`);
  }

  // --- Demo projects: create -> submit -> quote -> (one) select -> deliver -> review ---
  console.log('\nCreating demo projects...');

  const projects = [
    {
      customerEmail: 'liza@sweetnookbakery.ph',
      title: 'Cake Boxes for Weekend Orders',
      category: 'bakery',
      description: '8x8 inch windowed cake boxes with our logo printed in one colour.',
      quantity: 500,
      size_spec: '8 x 8 x 5 in',
      material_pref: 'Kraft / Natural Board',
      delivery_city: 'Pasig City',
      quoters: [
        { email: 'ramon@cebupackaging.ph', price: 18500, downPct: 50, days: 12, delivery: true, note: 'Includes food-grade coating and a printed proof before production.' },
        { email: 'grace@manilaprint.ph', price: 21750, downPct: 30, days: 7, delivery: false, note: 'Faster digital run, pickup at our Quezon City plant.' },
      ],
      selectQuoteFrom: 'ramon@cebupackaging.ph',
      carryToDelivered: true,
    },
    {
      customerEmail: 'carlo@brewbloom.ph',
      title: 'Product Labels for Cold Brew Bottles',
      category: 'labels',
      description: 'Waterproof roll labels for 350ml cold brew bottles, matte finish.',
      quantity: 2000,
      size_spec: '9 x 6 cm',
      material_pref: 'Paper Labels & Stickers',
      delivery_city: 'Cebu City',
      quoters: [
        { email: 'grace@manilaprint.ph', price: 9800, downPct: 40, days: 5, delivery: true, note: 'Waterproof vinyl stock recommended for cold-condensation bottles.' },
        { email: 'ben@luzonlargeformat.ph', price: 11200, downPct: 50, days: 8, delivery: true, note: 'Includes a physical proof shipped before full run.' },
      ],
    },
    {
      customerEmail: 'ana@luminousbeauty.ph',
      title: 'Launch Flyers for Skincare Line',
      category: 'marketing',
      description: 'A5 double-sided flyers announcing our new skincare line, glossy finish.',
      quantity: 3000,
      size_spec: 'A5',
      material_pref: 'Art Card / Coated Board',
      delivery_city: 'Makati City',
      quoters: [
        { email: 'ben@luzonlargeformat.ph', price: 7400, downPct: 30, days: 4, delivery: true, note: 'Same-week turnaround available if approved by Wednesday.' },
        { email: 'grace@manilaprint.ph', price: 6900, downPct: 50, days: 6, delivery: false, note: 'Pickup only, but our best price per piece at this volume.' },
      ],
    },
  ];

  for (const proj of projects) {
    const customerClient = await signIn(proj.customerEmail, PASSWORD);
    const customerId = await myUserId(customerClient);

    // Idempotency: skip if this exact title already exists for this customer.
    const { data: already } = await customerClient.from('projects').select('id, status').eq('customer_id', customerId).eq('title', proj.title).maybeSingle();
    let projectId = already?.id;

    if (!projectId) {
      const { data: created, error: createErr } = await customerClient
        .from('projects')
        .insert({
          customer_id: customerId,
          title: proj.title,
          category: proj.category,
          description: proj.description,
          quantity: proj.quantity,
          size_spec: proj.size_spec,
          material_pref: proj.material_pref,
          delivery_city: proj.delivery_city,
        })
        .select()
        .single();
      if (createErr) throw new Error(`create project failed: ${createErr.message}`);
      projectId = created.id;

      const { error: submitErr } = await customerClient.rpc('submit_project', { p_project_id: projectId });
      if (submitErr) throw new Error(`submit project failed: ${submitErr.message}`);
      console.log(`Project      "${proj.title}" submitted for ${proj.customerEmail}`);
    } else {
      console.log(`Project      "${proj.title}" already exists (${already.status}), skipping creation`);
    }

    // Quotes
    const quoteIds = {};
    for (const q of proj.quoters) {
      const partnerClient = await signIn(q.email, PASSWORD);
      const partnerId = await myPartnerId(partnerClient);

      const { data: existingQuote } = await partnerClient
        .from('quotes')
        .select('id, status')
        .eq('project_id', projectId)
        .eq('partner_id', partnerId)
        .in('status', ['DRAFT', 'SUBMITTED', 'SELECTED'])
        .maybeSingle();

      if (existingQuote) {
        quoteIds[q.email] = existingQuote.id;
        continue;
      }

      const { data: draft, error: draftErr } = await partnerClient
        .from('quotes')
        .insert({
          project_id: projectId,
          partner_id: partnerId,
          total_price: q.price,
          down_payment_pct: q.downPct,
          turnaround_days: q.days,
          delivery_available: q.delivery,
          note: q.note,
        })
        .select()
        .single();
      if (draftErr) throw new Error(`create quote failed: ${draftErr.message}`);

      const { error: submitQErr } = await partnerClient.rpc('submit_quote', { p_quote_id: draft.id });
      if (submitQErr) throw new Error(`submit quote failed: ${submitQErr.message}`);
      quoteIds[q.email] = draft.id;
      console.log(`  Quote      ${q.email} -> ₱${q.price.toLocaleString('en-PH')} on "${proj.title}"`);
    }

    if (proj.selectQuoteFrom) {
      const { data: projectNow } = await customerClient.from('projects').select('status').eq('id', projectId).single();
      if (projectNow.status === 'OPEN_FOR_QUOTES') {
        const { data: order, error: selectErr } = await customerClient
          .rpc('select_quote', { p_quote_id: quoteIds[proj.selectQuoteFrom] })
          .single();
        if (selectErr) throw new Error(`select quote failed: ${selectErr.message}`);
        console.log(`  Selected   ${proj.selectQuoteFrom} for "${proj.title}"`);

        // Orders open AWAITING_PAYMENT — pay the booking fee via the mock
        // PayMongo flow (same Edge Functions the browser uses) before a
        // partner can advance the order any further.
        const { data: checkout, error: checkoutErr } = await customerClient.functions.invoke('create-booking-checkout', {
          body: { order_id: order.id },
        });
        if (checkoutErr) throw new Error(`create-booking-checkout failed: ${checkoutErr.message}`);
        const { data: payment, error: paymentErr } = await customerClient
          .from('booking_payments')
          .select('provider_checkout_id, amount')
          .eq('order_id', order.id)
          .single();
        if (paymentErr) throw new Error(`read booking_payments failed: ${paymentErr.message}`);
        const { error: webhookErr } = await customerClient.functions.invoke('paymongo-webhook', {
          body: { mock: true, provider_checkout_id: payment.provider_checkout_id, outcome: 'paid' },
        });
        if (webhookErr) throw new Error(`paymongo-webhook failed: ${webhookErr.message}`);
        console.log(`  Paid       booking fee ₱${Number(payment.amount).toLocaleString('en-PH')} for "${proj.title}"`);

        if (proj.carryToDelivered) {
          const partnerClient = await signIn(proj.selectQuoteFrom, PASSWORD);
          for (const status of ['IN_PRODUCTION', 'READY', 'DELIVERED']) {
            const { error: advErr } = await partnerClient.rpc('update_order_status', {
              p_order_id: order.id,
              p_status: status,
              p_note: `Moved to ${status.replace('_', ' ').toLowerCase()}.`,
            });
            if (advErr) throw new Error(`advance order failed: ${advErr.message}`);
          }
          console.log(`  Delivered  "${proj.title}"`);

          const { error: reviewErr } = await customerClient.rpc('create_review', {
            p_order_id: order.id,
            p_rating: 5,
            p_comment: 'Boxes arrived clean and on time. The printed proof saved us a reprint.',
            p_would_work_again: true,
          });
          if (reviewErr && !/already reviewed/i.test(reviewErr.message)) {
            throw new Error(`create review failed: ${reviewErr.message}`);
          }
          console.log(`  Reviewed   "${proj.title}"`);
        }
      }
    }
  }

  // ==========================================================================
  // Designer marketplace
  //
  // Same discipline as everything above: real signup, real RPCs, RLS enforced.
  // Deliberately left in mixed states so every screen has something on it —
  // an empty marketplace demos as an unbuilt one.
  // ==========================================================================
  console.log('\nCreating designers...');

  const designers = [
    {
      email: 'ivy@castillostudio.ph',
      name: 'Ivy Castillo',
      city: 'Quezon City',
      specialties: ['packaging', 'label'],
      bio: 'Packaging and label design for Philippine food and beverage brands. Every file ships print-ready with dielines and bleed.',
      note: 'Six years in-house at a carton converter before going freelance.',
      turnaround: 7,
      rateMin: 6000,
      rateMax: 18000,
      approve: true,
      palette: [[236, 200, 160], [180, 120, 70]],
      samples: 4,
    },
    {
      email: 'noel@bautista.design',
      name: 'Noel Bautista',
      city: 'Cebu City',
      specialties: ['logo', 'product-graphics'],
      bio: 'Brand marks that survive being printed small. Logos, wordmarks, and the product graphics that follow from them.',
      note: 'Portfolio is mostly F&B and retail startups in Visayas.',
      turnaround: 5,
      rateMin: 4500,
      rateMax: 12000,
      approve: true,
      palette: [[168, 198, 214], [40, 78, 110]],
      samples: 3,
    },
    {
      email: 'marisol@aquinocreative.ph',
      name: 'Marisol Aquino',
      city: 'Davao City',
      // 'logo' matters: she proposes on the sourdough request below, and a
      // designer only receives an opportunity for specialties they list.
      specialties: ['label', 'logo', 'product-graphics'],
      bio: 'Label systems for small-batch producers — sauces, coffee, skincare. Comfortable with regulatory layout requirements.',
      note: 'Happy to work from photos if you have no existing brand assets.',
      turnaround: 6,
      rateMin: 3500,
      rateMax: 11000,
      approve: true,
      palette: [[214, 190, 205], [120, 60, 95]],
      samples: 3,
    },
    {
      // Left pending on purpose: the admin review queue needs something in it,
      // and with two low-resolution samples it also demonstrates the automated
      // flags (flag_low_sample_count + flag_low_resolution) firing.
      email: 'dennis@ocampo.works',
      name: 'Dennis Ocampo',
      city: 'Manila',
      specialties: ['logo'],
      bio: 'Logo and identity work.',
      note: 'Recently graduated, building out a print portfolio.',
      turnaround: null,
      rateMin: null,
      rateMax: null,
      approve: false,
      palette: [[200, 200, 200], [110, 110, 110]],
      samples: 2,
      lowRes: true,
    },
  ];

  const adminClient = await signIn(adminEmail, PASSWORD);

  for (const d of designers) {
    const { data: exists } = await serviceClient.rpc('email_exists', { p_email: d.email });
    if (exists) {
      console.log(`Designer     ${d.email} already exists, skipping`);
      continue;
    }

    await signUp(freshClient(), d.email, PASSWORD, {
      role: 'designer',
      display_name: d.name,
      city: d.city,
      specialties: d.specialties,
      bio: d.bio,
      application_note: d.note,
    });

    const designerClient = await signIn(d.email, PASSWORD);
    const designerId = await myDesignerId(designerClient);

    // Rates and turnaround are not part of signup — the designer fills them in
    // afterwards, so seed them the same way.
    if (d.turnaround || d.rateMin) {
      await designerClient
        .from('designer_profiles')
        .update({ typical_turnaround_days: d.turnaround, rate_min: d.rateMin, rate_max: d.rateMax })
        .eq('id', designerId);
    }

    // Portfolio. Uploaded as the designer, so the storage policy
    // (first path segment must equal my_designer_id()) is genuinely exercised.
    const [w, h] = d.lowRes ? [400, 300] : [1000, 750];
    for (let i = 1; i <= d.samples; i++) {
      const png = makePng(w, h, d.palette[0], d.palette[1]);
      const fileName = `sample-${i}.png`;
      const path = `${designerId}/${Date.now()}-${i}-${fileName}`;
      const { error: upErr } = await designerClient.storage
        .from('designer-portfolio')
        .upload(path, png, { contentType: 'image/png', upsert: false });
      if (upErr) throw new Error(`portfolio upload failed for ${d.email}: ${upErr.message}`);

      const { error: rowErr } = await designerClient.from('designer_portfolio_items').insert({
        designer_id: designerId,
        storage_path: path,
        file_name: fileName,
        mime_type: 'image/png',
        width_px: w,
        height_px: h,
        caption: `${d.specialties[0]} sample ${i}`,
      });
      if (rowErr) throw new Error(`portfolio row failed for ${d.email}: ${rowErr.message}`);
    }

    if (d.approve) {
      const { error: reviewErr } = await adminClient.rpc('admin_review_designer', {
        p_designer_id: designerId,
        p_decision: 'active',
        p_reason: 'Portfolio shows print-ready output — correct bleed, resolution, and file formats.',
      });
      if (reviewErr) throw new Error(`approve designer failed: ${reviewErr.message}`);
      console.log(`Designer     ${d.email} / ${PASSWORD}  (${d.name}, approved, ${d.samples} samples)`);
    } else {
      console.log(`Designer     ${d.email} / ${PASSWORD}  (${d.name}, PENDING REVIEW — see /admin/designers)`);
    }
  }

  // --- Design requests: open / delivered / draft -----------------------------
  console.log('\nCreating design requests...');

  const designRequests = [
    {
      customerEmail: 'liza@sweetnookbakery.ph',
      title: 'Logo and label set for a new sourdough line',
      specialty: 'logo',
      description:
        'Launching a sourdough sub-brand and need a mark that works on kraft bags and small stickers. Warm and handmade, not corporate.',
      budgetMin: 5000,
      budgetMax: 12000,
      // Left open with proposals waiting: this is the comparison screen.
      proposers: [
        { email: 'noel@bautista.design', price: 9500, downPct: 50, days: 6, revisions: 2, note: 'Includes the wordmark, a stamp variant for stickers, and files sized for kraft.' },
        { email: 'marisol@aquinocreative.ph', price: 7200, downPct: 40, days: 8, revisions: 3, note: 'Three initial directions, then we refine one. Extra revision round included.' },
      ],
    },
    {
      customerEmail: 'carlo@brewbloom.ph',
      title: 'Packaging design for single-origin coffee boxes',
      specialty: 'packaging',
      description:
        'Need a 250g box design for three single-origin beans, sharing one layout with a colour change per origin. Dieline available.',
      budgetMin: 8000,
      budgetMax: 20000,
      proposers: [
        { email: 'ivy@castillostudio.ph', price: 14000, downPct: 50, days: 7, revisions: 2, note: 'Dieline-accurate artwork, one layout with three colourways, packaged for your printer.' },
      ],
      // The full story: selected, paid, one revision round, approved, reviewed.
      selectFrom: 'ivy@castillostudio.ph',
      carryToDelivered: true,
    },
    {
      customerEmail: 'ana@luminousbeauty.ph',
      title: 'Product graphics for a serum range',
      specialty: 'product-graphics',
      description: 'Three SKUs, need consistent front-of-pack graphics. Still deciding on the final ingredient copy.',
      budgetMin: 6000,
      budgetMax: 15000,
      // Deliberately left as a DRAFT so the dashboard shows that state too.
      draft: true,
    },
  ];

  for (const dr of designRequests) {
    const customerClient = await signIn(dr.customerEmail, PASSWORD);
    const customerId = await myUserId(customerClient);

    const { data: already } = await customerClient
      .from('design_requests')
      .select('id, status')
      .eq('customer_id', customerId)
      .eq('title', dr.title)
      .maybeSingle();

    // Skip only what already exists, then carry on — mirroring the print
    // project block above. A blanket `continue` here meant that if anything
    // downstream failed, a re-run skipped the request entirely and it was
    // stranded without proposals forever.
    let requestId = already?.id;

    if (!requestId) {
      const { data: created, error: createErr } = await customerClient
        .from('design_requests')
        .insert({
          customer_id: customerId,
          title: dr.title,
          specialty: dr.specialty,
          description: dr.description,
          budget_min: dr.budgetMin,
          budget_max: dr.budgetMax,
        })
        .select()
        .single();
      if (createErr) throw new Error(`create design request failed: ${createErr.message}`);
      requestId = created.id;

      if (dr.draft) {
        console.log(`Design req   "${dr.title}" left as DRAFT for ${dr.customerEmail}`);
        continue;
      }

      const { error: submitErr } = await customerClient.rpc('submit_design_request', { p_request_id: requestId });
      if (submitErr) throw new Error(`submit design request failed: ${submitErr.message}`);
      console.log(`Design req   "${dr.title}" submitted for ${dr.customerEmail}`);
    } else {
      if (dr.draft) continue;
      console.log(`Design req   "${dr.title}" already exists (${already.status})`);
    }

    const proposalIds = {};
    for (const p of dr.proposers ?? []) {
      const designerClient = await signIn(p.email, PASSWORD);
      const designerId = await myDesignerId(designerClient);

      const { data: existingProposal } = await designerClient
        .from('design_proposals')
        .select('id')
        .eq('request_id', requestId)
        .eq('designer_id', designerId)
        .in('status', ['DRAFT', 'SUBMITTED', 'SELECTED'])
        .maybeSingle();
      if (existingProposal) {
        proposalIds[p.email] = existingProposal.id;
        continue;
      }

      /*
        A designer can only propose where they hold an opportunity, and
        opportunities are handed out by specialty. Checking here turns a
        seed-data mistake into a sentence that names the cause, instead of an
        opaque "violates row-level security policy" from the INSERT.
      */
      const { data: opp } = await designerClient
        .from('design_opportunities')
        .select('id')
        .eq('request_id', requestId)
        .eq('designer_id', designerId)
        .maybeSingle();
      if (!opp) {
        throw new Error(
          `${p.email} was never matched to "${dr.title}" (specialty '${dr.specialty}'), ` +
            `so they cannot propose on it. Add '${dr.specialty}' to that designer's specialties ` +
            `in this script, or list a different proposer. The RLS policy is correct.`,
        );
      }

      const { data: draft, error: draftErr } = await designerClient
        .from('design_proposals')
        .insert({
          request_id: requestId,
          designer_id: designerId,
          price: p.price,
          down_payment_pct: p.downPct,
          turnaround_days: p.days,
          revision_rounds_included: p.revisions,
          note: p.note,
        })
        .select()
        .single();
      if (draftErr) throw new Error(`create proposal failed: ${draftErr.message}`);

      const { error: subErr } = await designerClient.rpc('submit_design_proposal', { p_proposal_id: draft.id });
      if (subErr) throw new Error(`submit proposal failed: ${subErr.message}`);
      proposalIds[p.email] = draft.id;
      console.log(`  Proposal   ${p.email} -> ₱${p.price.toLocaleString('en-PH')} on "${dr.title}"`);
    }

    if (!dr.selectFrom) continue;

    // Everything below runs once. On a re-run the request has already moved
    // past OPEN_FOR_PROPOSALS, and selecting again would (correctly) be
    // refused by select_design_proposal().
    const { data: requestNow } = await customerClient
      .from('design_requests')
      .select('status')
      .eq('id', requestId)
      .single();
    if (requestNow.status !== 'OPEN_FOR_PROPOSALS') {
      console.log(`  Already    "${dr.title}" is ${requestNow.status}, leaving as is`);
      continue;
    }

    const { data: order, error: selErr } = await customerClient
      .rpc('select_design_proposal', { p_proposal_id: proposalIds[dr.selectFrom] })
      .single();
    if (selErr) throw new Error(`select proposal failed: ${selErr.message}`);
    console.log(`  Selected   ${dr.selectFrom} for "${dr.title}"`);

    // Platform fee. Tries the real Edge Function path first, exactly as the
    // browser does; falls back to settling as the webhook would if the local
    // edge runtime is unavailable (a documented local-only flake — see the
    // header of tests/marketplace.test.ts). A half-seeded demo is worse than
    // one that took the shortcut, so this does not abort on that failure.
    const { data: designPayment } = await customerClient
      .from('design_payments')
      .select('provider_checkout_id, amount')
      .eq('order_id', order.id)
      .single();

    let settled = false;
    try {
      const { error: coErr } = await customerClient.functions.invoke('create-booking-checkout', {
        body: { order_id: order.id, kind: 'design' },
      });
      if (coErr) throw coErr;
      const { data: refreshed } = await customerClient
        .from('design_payments')
        .select('provider_checkout_id')
        .eq('order_id', order.id)
        .single();
      const { error: whErr } = await customerClient.functions.invoke('paymongo-webhook', {
        body: { mock: true, provider_checkout_id: refreshed.provider_checkout_id, outcome: 'paid', kind: 'design' },
      });
      if (whErr) throw whErr;
      settled = true;
    } catch {
      await serviceClient
        .from('design_payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('order_id', order.id);
      await serviceClient.from('design_orders').update({ status: 'CONFIRMED' }).eq('id', order.id).eq('status', 'AWAITING_PAYMENT');
      await serviceClient.from('design_order_status_events').insert({
        order_id: order.id,
        status: 'CONFIRMED',
        note: 'Platform fee received — order confirmed.',
        created_by: null,
      });
      console.log('  (edge runtime unavailable — settled the platform fee directly)');
    }
    console.log(`  Paid       platform fee ₱${Number(designPayment.amount).toLocaleString('en-PH')}${settled ? '' : ' (fallback)'}`);

    if (!dr.carryToDelivered) continue;

    const designerClient = await signIn(dr.selectFrom, PASSWORD);

    // Two revision rounds, so the deliverables panel shows a real exchange
    // rather than a single file.
    const rounds = [
      { file: 'coffee-box-v1.png', palette: [[222, 196, 168], [140, 92, 52]], feedback: 'Close. Can the origin name sit higher, and the roast date panel be larger?' },
      { file: 'coffee-box-v2.png', palette: [[228, 206, 176], [120, 76, 40]], feedback: null },
    ];

    for (const round of rounds) {
      const png = makePng(1200, 900, round.palette[0], round.palette[1]);
      const path = `${order.id}/${Date.now()}-${round.file}`;
      const { error: upErr } = await designerClient.storage
        .from('design-deliverables')
        .upload(path, png, { contentType: 'image/png', upsert: false });
      if (upErr) throw new Error(`deliverable upload failed: ${upErr.message}`);

      const { data: deliverable, error: delErr } = await designerClient
        .rpc('submit_design_deliverable', {
          p_order_id: order.id,
          p_storage_path: path,
          p_file_name: round.file,
          p_mime_type: 'image/png',
          p_size_bytes: png.length,
        })
        .single();
      if (delErr) throw new Error(`submit deliverable failed: ${delErr.message}`);

      const { error: revErr } = await customerClient.rpc('review_design_deliverable', {
        p_deliverable_id: deliverable.id,
        p_approved: round.feedback === null,
        p_feedback: round.feedback ?? undefined,
      });
      if (revErr) throw new Error(`review deliverable failed: ${revErr.message}`);
      console.log(`  ${round.feedback ? 'Revised   ' : 'Approved  '} ${round.file}`);
    }

    const { error: drReviewErr } = await customerClient.rpc('create_design_review', {
      p_order_id: order.id,
      p_rating: 5,
      p_comment: 'Understood the brief straight away and the dieline came back print-ready. The printer had no questions.',
      p_would_work_again: true,
    });
    if (drReviewErr && !/already reviewed/i.test(drReviewErr.message)) {
      throw new Error(`create design review failed: ${drReviewErr.message}`);
    }
    console.log(`  Reviewed   "${dr.title}"`);
  }

  console.log('\nSeed complete. All accounts use the password: ' + PASSWORD);
  console.log('Sign in at the app with any customer, partner, designer, or admin email above.');
  console.log('Designer demo: /designers (public directory), /designer (workspace), /admin/designers (1 pending application).');
}

main().catch((e) => {
  console.error('\nSeed failed:', e.message);
  process.exit(1);
});
