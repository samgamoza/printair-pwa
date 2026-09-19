/**
 * Sample data for demo mode (`npm run demo`). Nothing here is real, and none of it ships in a
 * production build. Field names match the database so the real screens render it unchanged.
 */
export type Row = Record<string, unknown>;

const now = Date.now();
const ago = (d: number) => new Date(now - d * 864e5).toISOString();
const inDays = (d: number) => new Date(now + d * 864e5).toISOString().slice(0, 10);

export const USERS: Record<string, Row> = {
  customer: { id: 'u-cust', role: 'customer', full_name: 'Maria Santos', email: 'maria@kapekalye.ph', mobile: '09171234567', city: 'Pasig City', avatar_url: null, status: 'active', created_at: ago(40) },
  partner: { id: 'u-part', role: 'partner', full_name: 'Ramon Dela Cruz', email: 'ramon@manilaoffset.ph', mobile: null, city: 'Quezon City', avatar_url: null, status: 'active', created_at: ago(90) },
  designer: { id: 'u-des', role: 'designer', full_name: 'Bea Villanueva', email: 'bea@studio.ph', mobile: null, city: 'Cebu City', avatar_url: null, status: 'active', created_at: ago(30) },
  admin: { id: 'u-adm', role: 'admin', full_name: 'Sam Gamo', email: 'admin@printair.ph', mobile: null, city: 'Manila', avatar_url: null, status: 'active', created_at: ago(200) },
};

const partnerProfiles: Row[] = [
  { id: 'pp1', user_id: 'u-part', business_name: 'Manila Offset Press', contact_name: 'Ramon Dela Cruz', city: 'Quezon City', description: 'Eight-colour offset and folding cartons for food and retail brands since 1998.', typical_turnaround_days: 12, service_areas: ['Metro Manila', 'Cavite', 'Laguna'], services: ['Offset Printing', 'Folding Cartons', 'Die-Cutting'], logo_url: null, portfolio_images: [], status: 'active', created_at: ago(90) },
  { id: 'pp2', user_id: 'u-p2', business_name: 'Davao Digital Print Co.', contact_name: 'Liza Ong', city: 'Davao City', description: 'Short-run digital labels and stickers with same-day proofs.', typical_turnaround_days: 5, service_areas: ['Davao Region'], services: ['Digital Printing', 'Labels & Stickers'], logo_url: null, portfolio_images: [], status: 'active', created_at: ago(60) },
  { id: 'pp3', user_id: 'u-p3', business_name: 'Cebu Packaging Solutions', contact_name: 'Jun Abella', city: 'Mandaue City', description: 'Corrugated and kraft packaging for food businesses across the Visayas.', typical_turnaround_days: 14, service_areas: ['Cebu', 'Bohol'], services: ['Corrugated Boxes', 'Flexible Packaging'], logo_url: null, portfolio_images: [], status: 'suspended', created_at: ago(50) },
];
const partnerDirectory = partnerProfiles.filter((p) => p.status === 'active').concat([{ ...partnerProfiles[2], status: 'active' }]).map((p, i) => ({
  id: p.id, business_name: p.business_name, city: p.city, description: p.description, typical_turnaround_days: p.typical_turnaround_days,
  service_areas: p.service_areas, services: p.services, logo_url: null, portfolio_images: [], created_at: p.created_at,
  categories: [['coffee', 'bakery', 'food'], ['labels', 'beauty'], ['food', 'product', 'retail']][i], completed_projects: [48, 21, 0][i], average_rating: [4.8, 4.6, 0][i], review_count: [31, 12, 0][i],
}));

const projects: Row[] = [
  { id: 'p1', customer_id: 'u-cust', title: 'Cup Sleeves', category: 'coffee', description: 'Kraft cup sleeves for 12oz cups with our one-colour logo.', quantity: 1000, quantity_note: '500–2,000', size_spec: '4.5 × 2.5 in', material_pref: 'Kraft / Natural Board', finishing_pref: 'unsure', target_date: inDays(21), delivery_city: 'Pasig City', notes: 'Timeline preference: 2–3 weeks.', status: 'OPEN_FOR_QUOTES', selected_quote_id: null, created_at: ago(3), updated_at: ago(0.2) },
  { id: 'p2', customer_id: 'u-cust', title: 'Pastry Boxes', category: 'bakery', description: 'Windowed pastry boxes, 8×8×3 in, full colour outside.', quantity: 500, quantity_note: '100–500', size_spec: '8 × 8 × 3 in', material_pref: 'Art Card / Coated Board', finishing_pref: 'Matte lamination', target_date: inDays(10), delivery_city: 'Pasig City', notes: null, status: 'IN_PROGRESS', selected_quote_id: 'q4', created_at: ago(14), updated_at: ago(1) },
  { id: 'p3', customer_id: 'u-cust', title: 'Product Labels', category: 'labels', description: 'Waterproof roll labels for cold brew bottles.', quantity: null, quantity_note: '2,000–10,000', size_spec: null, material_pref: null, finishing_pref: null, target_date: null, delivery_city: 'Pasig City', notes: null, status: 'DRAFT', selected_quote_id: null, created_at: ago(1), updated_at: ago(1) },
  { id: 'p4', customer_id: 'u-cust', title: 'Loyalty Cards', category: 'coffee', description: 'Punch cards, 2×3.5 in, textured stock.', quantity: 2000, quantity_note: null, size_spec: '3.5 × 2 in', material_pref: 'Textured / Specialty Paper', finishing_pref: null, target_date: null, delivery_city: 'Pasig City', notes: null, status: 'DELIVERED', selected_quote_id: 'q9', created_at: ago(50), updated_at: ago(20) },
  { id: 'p5', customer_id: 'u-cust', title: 'Takeaway Bags', category: 'coffee', description: 'Kraft bags with flat handles.', quantity: 3000, quantity_note: null, size_spec: '8 × 10 × 4 in', material_pref: 'Kraft / Natural Board', finishing_pref: null, target_date: inDays(5), delivery_city: 'Pasig City', notes: null, status: 'PROVIDER_SELECTED', selected_quote_id: 'q7', created_at: ago(6), updated_at: ago(0.5) },
];

const quotes: Row[] = [
  { id: 'q1', project_id: 'p1', partner_id: 'pp1', total_price: 18500, down_payment_pct: 50, turnaround_days: 12, estimated_completion: inDays(14), delivery_available: true, note: 'Includes one printed proof and delivery within Metro Manila.', valid_until: inDays(10), status: 'SUBMITTED', created_at: ago(1), updated_at: ago(1) },
  { id: 'q2', project_id: 'p1', partner_id: 'pp2', total_price: 19200, down_payment_pct: 30, turnaround_days: 7, estimated_completion: inDays(9), delivery_available: false, note: 'Digital run, so colour is approved from a same-day proof.', valid_until: inDays(7), status: 'SUBMITTED', created_at: ago(0.8), updated_at: ago(0.8) },
  { id: 'q3', project_id: 'p1', partner_id: 'pp3', total_price: 17250, down_payment_pct: 50, turnaround_days: 15, estimated_completion: inDays(17), delivery_available: true, note: null, valid_until: inDays(14), status: 'SUBMITTED', created_at: ago(0.5), updated_at: ago(0.5) },
  { id: 'q4', project_id: 'p2', partner_id: 'pp1', total_price: 24800, down_payment_pct: 50, turnaround_days: 10, estimated_completion: inDays(6), delivery_available: true, note: 'Window patching done in-house.', valid_until: inDays(3), status: 'SELECTED', created_at: ago(12), updated_at: ago(10) },
  { id: 'q7', project_id: 'p5', partner_id: 'pp1', total_price: 41000, down_payment_pct: 50, turnaround_days: 14, estimated_completion: inDays(15), delivery_available: true, note: null, valid_until: inDays(9), status: 'SELECTED', created_at: ago(4), updated_at: ago(0.5) },
  { id: 'q9', project_id: 'p4', partner_id: 'pp1', total_price: 9800, down_payment_pct: 50, turnaround_days: 8, estimated_completion: ago(22).slice(0, 10), delivery_available: true, note: null, valid_until: null, status: 'SELECTED', created_at: ago(48), updated_at: ago(45) },
  { id: 'q10', project_id: 'p4', partner_id: 'pp2', total_price: 11200, down_payment_pct: 50, turnaround_days: 6, estimated_completion: null, delivery_available: false, note: null, valid_until: null, status: 'NOT_SELECTED', created_at: ago(48), updated_at: ago(45) },
];

const orders: Row[] = [
  { id: 'o2', project_id: 'p2', partner_id: 'pp1', customer_id: 'u-cust', quote_id: 'q4', status: 'IN_PRODUCTION', created_at: ago(10), updated_at: ago(1), delivered_at: null },
  { id: 'o5', project_id: 'p5', partner_id: 'pp1', customer_id: 'u-cust', quote_id: 'q7', status: 'AWAITING_PAYMENT', created_at: ago(0.5), updated_at: ago(0.5), delivered_at: null },
  { id: 'o4', project_id: 'p4', partner_id: 'pp1', customer_id: 'u-cust', quote_id: 'q9', status: 'DELIVERED', created_at: ago(45), updated_at: ago(20), delivered_at: ago(20) },
];
const orderEvents: Row[] = [
  { id: 'e1', order_id: 'o2', status: 'AWAITING_PAYMENT', note: null, created_at: ago(10) },
  { id: 'e2', order_id: 'o2', status: 'CONFIRMED', note: null, created_at: ago(9.8) },
  { id: 'e3', order_id: 'o2', status: 'IN_PRODUCTION', note: 'Plates are made — printing starts tomorrow morning.', created_at: ago(1) },
  { id: 'e4', order_id: 'o5', status: 'AWAITING_PAYMENT', note: null, created_at: ago(0.5) },
  { id: 'e5', order_id: 'o4', status: 'CONFIRMED', note: null, created_at: ago(44) },
  { id: 'e6', order_id: 'o4', status: 'DELIVERED', note: 'Delivered to your café. Thank you!', created_at: ago(20) },
];
const bookingPayments: Row[] = [{ id: 'bp5', order_id: 'o5', amount: 2050, currency: 'PHP', status: 'pending', provider: 'paymongo', provider_checkout_id: 'cs_1', provider_payment_id: null, paid_at: null, created_at: ago(0.5), updated_at: ago(0.5) }];
const opportunities: Row[] = [
  { id: 'op1', project_id: 'p1', partner_id: 'pp1', status: 'QUOTED', question: 'Should the sleeves fit 12oz and 16oz cups, or 12oz only?', answer: null, created_at: ago(2), updated_at: ago(1) },
  { id: 'op2', project_id: 'p1', partner_id: 'pp2', status: 'QUOTED', question: 'Is a one-colour black print fine, or do you need a brand Pantone?', answer: 'One-colour black is perfect.', created_at: ago(2), updated_at: ago(0.7) },
  { id: 'op3', project_id: 'px1', partner_id: 'pp1', status: 'NEW', question: null, answer: null, created_at: ago(0.1), updated_at: ago(0.1) },
  { id: 'op4', project_id: 'px2', partner_id: 'pp1', status: 'VIEWED', question: null, answer: null, created_at: ago(1), updated_at: ago(1) },
];
const extraProjects: Record<string, Row> = {
  px1: { id: 'px1', customer_id: 'u-x', title: 'Cake Boxes', category: 'bakery', description: 'Windowed 10×10×5 in cake boxes, two-colour print on kraft.', quantity: 800, quantity_note: '500–2,000', size_spec: '10 × 10 × 5 in', material_pref: 'Kraft / Natural Board', finishing_pref: 'unsure', target_date: inDays(18), delivery_city: 'Marikina City', notes: 'Timeline preference: 2–3 weeks.', status: 'OPEN_FOR_QUOTES', created_at: ago(0.1), updated_at: ago(0.1) },
  px2: { id: 'px2', customer_id: 'u-y', title: 'Shopping Bags', category: 'retail', description: 'Rope-handle paper bags, full colour, 2 sizes.', quantity: null, quantity_note: '2,000–10,000', size_spec: null, material_pref: 'Art Card / Coated Board', finishing_pref: 'Gloss lamination', target_date: null, delivery_city: 'Makati City', notes: null, status: 'OPEN_FOR_QUOTES', created_at: ago(1), updated_at: ago(1) },
};
const reviews: Row[] = [
  { id: 'r1', order_id: 'o4', project_id: 'p4', partner_id: 'pp1', customer_id: 'u-cust', rating: 5, comment: 'Crisp print, delivered two days early. The textured stock feels premium.', would_work_again: true, hidden: false, hidden_reason: null, created_at: ago(19) },
  { id: 'r2', order_id: 'o9', project_id: 'p9', partner_id: 'pp1', customer_id: 'u-z', rating: 4, comment: 'Good quality. Proof took a little longer than expected.', would_work_again: true, hidden: false, hidden_reason: null, created_at: ago(33) },
  { id: 'r3', order_id: 'o8', project_id: 'p8', partner_id: 'pp2', customer_id: 'u-w', rating: 1, comment: 'spam spam spam', would_work_again: false, hidden: true, hidden_reason: 'Spam — not a real customer review.', created_at: ago(5) },
];

// ---- designer side
const designerProfile: Row = { id: 'dp1', user_id: 'u-des', display_name: 'Bea Villanueva', city: 'Cebu City', bio: 'Dieline-first packaging and label design for local food brands.', application_note: null, typical_turnaround_days: 5, rate_min: 3500, rate_max: 15000, avatar_url: null, status: 'active', review_reason: null, reviewed_at: ago(25), created_at: ago(30) };
const designerDirectory: Row[] = [
  { id: 'dp1', display_name: 'Bea Villanueva', city: 'Cebu City', bio: designerProfile.bio, specialties: ['packaging', 'label'], rate_min: 3500, rate_max: 15000, typical_turnaround_days: 5, completed_orders: 14, average_rating: 4.9, review_count: 11, portfolio_count: 6, avatar_url: null, created_at: ago(30) },
  { id: 'dp2', display_name: 'Marco Reyes', city: 'Makati City', bio: 'Logos and wordmarks that survive a one-colour print.', specialties: ['logo'], rate_min: 5000, rate_max: 20000, typical_turnaround_days: 7, completed_orders: 8, average_rating: 4.7, review_count: 6, portfolio_count: 9, avatar_url: null, created_at: ago(40) },
  { id: 'dp3', display_name: 'Ina Lim', city: 'Davao City', bio: 'Product graphics and label systems.', specialties: ['product-graphics', 'label'], rate_min: null, rate_max: null, typical_turnaround_days: null, completed_orders: 0, average_rating: 0, review_count: 0, portfolio_count: 3, avatar_url: null, created_at: ago(4) },
];
const designRequests: Row[] = [
  { id: 'd1', customer_id: 'u-cust', title: 'Logo for Kape Kalye', specialty: 'logo', description: 'A friendly wordmark plus a small icon that works on a cup sleeve.', budget_min: 5000, budget_max: 12000, target_date: inDays(14), notes: null, status: 'IN_PROGRESS', selected_proposal_id: 'dpr1', created_at: ago(9), updated_at: ago(0.3) },
  { id: 'd2', customer_id: 'u-cust', title: 'Cold brew label', specialty: 'label', description: 'Waterproof label for 250ml bottles.', budget_min: 3000, budget_max: 8000, target_date: null, notes: null, status: 'OPEN_FOR_PROPOSALS', selected_proposal_id: null, created_at: ago(2), updated_at: ago(0.4) },
];
const designProposals: Row[] = [
  { id: 'dpr1', request_id: 'd1', designer_id: 'dp2', price: 9500, down_payment_pct: 50, turnaround_days: 6, revision_rounds_included: 2, note: 'Three concepts, then two rounds on the chosen one.', valid_until: inDays(4), status: 'SELECTED', created_at: ago(8), updated_at: ago(7) },
  { id: 'dpr2', request_id: 'd2', designer_id: 'dp1', price: 6500, down_payment_pct: 50, turnaround_days: 5, revision_rounds_included: 2, note: 'Print-ready with bleed and a dieline for your label shape.', valid_until: inDays(7), status: 'SUBMITTED', created_at: ago(1), updated_at: ago(1) },
  { id: 'dpr3', request_id: 'd2', designer_id: 'dp3', price: 4800, down_payment_pct: 40, turnaround_days: 8, revision_rounds_included: 3, note: null, valid_until: inDays(10), status: 'SUBMITTED', created_at: ago(0.5), updated_at: ago(0.5) },
];
const designOrders: Row[] = [
  { id: 'do1', request_id: 'd1', designer_id: 'dp2', customer_id: 'u-cust', proposal_id: 'dpr1', status: 'IN_PROGRESS', created_at: ago(7), updated_at: ago(0.3), delivered_at: null },
  { id: 'do2', request_id: 'dx', designer_id: 'dp1', customer_id: 'u-q', proposal_id: 'dprx', status: 'IN_PROGRESS', created_at: ago(5), updated_at: ago(0.2), delivered_at: null },
];
const designOrderEvents: Row[] = [
  { id: 'de1', order_id: 'do1', status: 'AWAITING_PAYMENT', note: null, created_at: ago(7) },
  { id: 'de2', order_id: 'do1', status: 'CONFIRMED', note: null, created_at: ago(6.9) },
  { id: 'de3', order_id: 'do1', status: 'IN_PROGRESS', note: null, created_at: ago(3) },
  { id: 'de4', order_id: 'do2', status: 'CONFIRMED', note: null, created_at: ago(5) },
  { id: 'de5', order_id: 'do2', status: 'IN_PROGRESS', note: null, created_at: ago(2) },
];
const deliverables: Row[] = [
  { id: 'dl1', order_id: 'do1', revision_number: 1, file_name: 'kape-kalye-logo-v1.pdf', mime_type: 'application/pdf', size_bytes: 2400000, storage_path: 'do1/v1.pdf', approved: false, approved_at: null, customer_feedback: 'Love the icon. Can the wordmark be a bit rounder?', uploaded_by: 'u-d2', created_at: ago(3) },
  { id: 'dl2', order_id: 'do1', revision_number: 2, file_name: 'kape-kalye-logo-v2.pdf', mime_type: 'application/pdf', size_bytes: 2600000, storage_path: 'do1/v2.pdf', approved: false, approved_at: null, customer_feedback: null, uploaded_by: 'u-d2', created_at: ago(0.3) },
  { id: 'dl3', order_id: 'do2', revision_number: 1, file_name: 'hot-sauce-labels-v1.pdf', mime_type: 'application/pdf', size_bytes: 5100000, storage_path: 'do2/v1.pdf', approved: false, approved_at: null, customer_feedback: 'Make the "extra hot" red angrier.', uploaded_by: 'u-des', created_at: ago(1) },
];
const designOpps: Row[] = [
  { id: 'dop1', request_id: 'd2', designer_id: 'dp1', status: 'PROPOSED', question: null, answer: null, created_at: ago(2), updated_at: ago(1) },
  { id: 'dop2', request_id: 'dy', designer_id: 'dp1', status: 'NEW', question: null, answer: null, created_at: ago(0.1), updated_at: ago(0.1) },
];
const reviewQueue: Row[] = [
  { id: 'dq1', display_name: 'Paolo Cruz', city: 'Iloilo City', bio: 'Freelance packaging designer, 4 years.', application_note: 'Most of my recent work is dieline-first packaging for local food brands.', specialties: ['packaging'], applied_at: ago(2), portfolio_count: 2, flag_low_sample_count: true, flag_bad_format: false, flag_low_resolution: true },
  { id: 'dq2', display_name: 'Trina Yu', city: 'Taguig', bio: 'Brand and label designer.', application_note: null, specialties: ['logo', 'label'], applied_at: ago(1), portfolio_count: 6, flag_low_sample_count: false, flag_bad_format: false, flag_low_resolution: false },
];
const designReviews: Row[] = [{ id: 'dr1', order_id: 'dox', request_id: 'dz', designer_id: 'dp1', customer_id: 'u-k', rating: 5, comment: 'Files went straight to the printer with zero fixes.', would_work_again: true, hidden: false, hidden_reason: null, created_at: ago(12) }];

const allProfiles: Row[] = [...Object.values(USERS), { id: 'u-p2', role: 'partner', full_name: 'Liza Ong', email: 'liza@davaodigital.ph', status: 'active', created_at: ago(60) }, { id: 'u-p3', role: 'partner', full_name: 'Jun Abella', email: 'jun@cebupack.ph', status: 'suspended', created_at: ago(50) }];


projects.push(...Object.values(extraProjects));
designRequests.push(
  { customer_id: 'u-other', created_at: ago(9), updated_at: ago(1), id: 'dx', title: 'Hot sauce label system', specialty: 'label', description: 'Three heat levels, one family.', budget_min: 6000, budget_max: 14000, status: 'IN_PROGRESS' },
  { customer_id: 'u-other', created_at: ago(9), updated_at: ago(1), id: 'dy', title: 'Mailer box for a candle brand', specialty: 'packaging', description: 'Two-colour print on kraft mailer, inside print too.', budget_min: 8000, budget_max: 18000, target_date: inDays(20), notes: null, status: 'OPEN_FOR_PROPOSALS' },
  { title: 'Bakery box redesign' },
  { id: 'dz', customer_id: 'u-other', title: 'Bakery box redesign', specialty: 'packaging', description: 'Refresh of an existing cake box.', budget_min: 7000, budget_max: 15000, target_date: null, notes: null, status: 'DELIVERED', created_at: ago(30), updated_at: ago(12) },
);

export const TABLES: Record<string, Row[]> = {
  profiles: allProfiles,
  partner_profiles: partnerProfiles,
  designer_profiles: [designerProfile, { id: 'dp2', user_id: 'u-d2', display_name: 'Marco Reyes', city: 'Makati City', status: 'active' }, { id: 'dp3', user_id: 'u-d3', display_name: 'Ina Lim', city: 'Davao City', status: 'active' }],
  partner_directory: partnerDirectory,
  designer_directory: designerDirectory,
  projects,
  quotes,
  orders,
  order_status_events: orderEvents,
  booking_payments: bookingPayments,
  opportunities,
  reviews,
  project_files: [{ id: 'f1', project_id: 'p2', storage_path: 'p2/art.pdf', file_name: 'pastry-box-artwork.pdf', mime_type: 'application/pdf', size_bytes: 3400000, uploaded_by: 'u-cust' }],
  partner_capabilities: [
    { partner_id: 'pp1', category: 'coffee' },
    { partner_id: 'pp1', category: 'bakery' },
    { partner_id: 'pp1', category: 'retail' },
  ],
  design_requests: designRequests,
  design_request_files: [],
  design_proposals: designProposals,
  design_orders: designOrders,
  design_order_status_events: designOrderEvents,
  design_deliverables: deliverables,
  design_payments: [],
  design_reviews: designReviews,
  design_opportunities: designOpps,
  designer_specialties: [
    { designer_id: 'dp1', specialty: 'packaging' },
    { designer_id: 'dp1', specialty: 'label' },
  ],
  designer_portfolio_items: [],
  designer_admin_review_queue: reviewQueue,
  print_categories: [],
};
