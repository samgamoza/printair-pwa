/**
 * Demo mode: a pretend backend that lives in the browser tab.
 *
 * `npm run demo` starts the app with VITE_DEMO=1. Every request the app would send to Supabase
 * (data, sign-in, files, edge functions) is answered here from sample data instead, so the whole
 * product can be clicked through with no database, no accounts and no internet. Changes you make
 * (submitting a project, choosing a quote, advancing an order) last until the tab is closed.
 *
 * This file is only ever loaded when VITE_DEMO=1, by a dynamic import in main.tsx, so none of it
 * is in a normal production build.
 */
import { TABLES, USERS, type Row } from './fixtures';

const BASE = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
const STORAGE_KEY = `sb-${new URL(BASE).hostname.split('.')[0]}-auth-token`;
export const DEMO_ROLE_KEY = 'printair.demo.role';
const SNAPSHOT_KEY = 'printair.demo.tables';

/**
 * The sample data lives in memory, but paying and switching role both reload the page. A copy is
 * kept in sessionStorage so what you did survives those reloads — choose a quote as the customer,
 * then switch to the printing partner and the won job is there. It clears when the tab closes.
 */
function saveSnapshot() {
  try {
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(TABLES));
  } catch {
    /* storage full or blocked: the demo still works, it just forgets on reload */
  }
}

function restoreSnapshot() {
  try {
    const saved = sessionStorage.getItem(SNAPSHOT_KEY);
    if (saved) Object.assign(TABLES, JSON.parse(saved));
  } catch {
    sessionStorage.removeItem(SNAPSHOT_KEY);
  }
}

/** Puts every sample record back the way it started. */
export function resetDemoData() {
  sessionStorage.removeItem(SNAPSHOT_KEY);
}

const FOREIGN_KEYS: Record<string, string> = {
  project: 'project_id',
  partner: 'partner_id',
  customer: 'customer_id',
  designer: 'designer_id',
  request: 'request_id',
};

let counter = 1000;
const newId = (prefix: string) => `${prefix}-${++counter}`;
const nowIso = () => new Date().toISOString();

function b64url(value: unknown) {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sessionFor(user: Row) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const jwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.demo`;
  return {
    access_token: jwt,
    refresh_token: 'demo-refresh',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 30,
    expires_at: exp,
    user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: user.created_at },
  };
}

function currentUser(): Row | null {
  const role = localStorage.getItem(DEMO_ROLE_KEY);
  return role && USERS[role] ? USERS[role] : null;
}

/** Switches the pretend signed-in person. `null` signs out. */
export function setDemoRole(role: string | null) {
  if (role && USERS[role]) {
    localStorage.setItem(DEMO_ROLE_KEY, role);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionFor(USERS[role])));
  } else {
    localStorage.removeItem(DEMO_ROLE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  });
}

/* ---------- PostgREST-style reads and writes ---------- */

function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows;
  for (const [column, expr] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(column)) continue;
    const match = /^(eq|neq|in|is|not\.is)\.(.*)$/.exec(expr);
    if (!match) continue;
    const [, op, raw] = match;
    if (op === 'eq') out = out.filter((r) => String(r[column]) === raw);
    if (op === 'neq') out = out.filter((r) => String(r[column]) !== raw);
    if (op === 'in') {
      const wanted = raw.replace(/[()"]/g, '').split(',');
      out = out.filter((r) => wanted.includes(String(r[column])));
    }
    if (op === 'is' && raw === 'null') out = out.filter((r) => r[column] === null || r[column] === undefined);
    if (op === 'not.is') out = out.filter((r) => r[column] !== null && r[column] !== undefined);
  }
  return out;
}

function applyOrder(rows: Row[], params: URLSearchParams): Row[] {
  const order = params.get('order');
  if (!order) return rows;
  const [column, direction] = order.split(',')[0].split('.');
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => (String(a[column] ?? '') > String(b[column] ?? '') ? sign : String(a[column] ?? '') < String(b[column] ?? '') ? -sign : 0));
}

/** Resolves `alias:table(...)` joins in a select string by looking the related row up by id. */
function embed(rows: Row[], select: string | null): Row[] {
  if (!select) return rows;
  const joins = [...select.matchAll(/(\w+):(\w+)(?:!\w+)?\(/g)].map(([, alias, table]) => ({ alias, table }));
  if (!joins.length) return rows;
  return rows.map((row) => {
    const copy: Row = { ...row };
    for (const { alias, table } of joins) {
      const fk = FOREIGN_KEYS[alias];
      copy[alias] = (fk && (TABLES[table] ?? []).find((r) => r.id === row[fk])) ?? null;
    }
    return copy;
  });
}

function handleRest(table: string, method: string, url: URL, headers: Headers, body: unknown): Response {
  const rows = (TABLES[table] ??= []);
  const wantsOne = (headers.get('accept') ?? '').includes('vnd.pgrst.object');
  const select = url.searchParams.get('select');
  let result: Row[];

  if (method === 'GET' || method === 'HEAD') {
    result = applyOrder(applyFilters(rows, url.searchParams), url.searchParams);
  } else if (method === 'POST') {
    const incoming = (Array.isArray(body) ? body : [body]) as Row[];
    result = incoming.map((r) => ({ id: newId(table.slice(0, 2)), created_at: nowIso(), updated_at: nowIso(), status: r.status ?? defaultStatus(table), ...r }));
    rows.push(...result);
  } else if (method === 'PATCH') {
    result = applyFilters(rows, url.searchParams);
    result.forEach((r) => Object.assign(r, body as Row, { updated_at: nowIso() }));
  } else if (method === 'DELETE') {
    result = applyFilters(rows, url.searchParams);
    TABLES[table] = rows.filter((r) => !result.includes(r));
  } else {
    return json({ message: 'Unsupported in demo mode' }, 405);
  }

  const total = result.length;
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = url.searchParams.get('limit');
  const range = headers.get('range');
  let from = offset;
  let to = limit ? offset + Number(limit) - 1 : total - 1;
  if (range && /^\d+-\d+$/.test(range)) [from, to] = range.split('-').map(Number);
  const page = embed(result.slice(from, to + 1), select);
  const contentRange = { 'content-range': `${total ? from : '*'}-${total ? Math.min(to, total - 1) : '*'}/${total}` };

  if (wantsOne) {
    if (!page.length) return json({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'No rows' }, 406);
    return json(page[0], 200, contentRange);
  }
  if ((headers.get('prefer') ?? '').includes('return=minimal') || (method !== 'GET' && !select)) return json(null, 204, contentRange);
  return json(page, 200, contentRange);
}

function defaultStatus(table: string): string | undefined {
  if (['projects', 'design_requests', 'quotes', 'design_proposals'].includes(table)) return 'DRAFT';
  return undefined;
}

/* ---------- The database functions the app calls ---------- */

const find = (table: string, id: unknown) => (TABLES[table] ?? []).find((r) => r.id === id);

function addEvent(table: string, orderId: unknown, status: string, note?: unknown) {
  TABLES[table].push({ id: newId('ev'), order_id: orderId, status, note: note ?? null, created_at: nowIso() });
}

function handleRpc(name: string, args: Row): Response {
  const user = currentUser();
  switch (name) {
    case 'email_exists':
      return json(Object.values(USERS).some((u) => u.email === args.p_email));

    // Sample marketplace activity, for the demo only. The real function (docs/BACKEND-FOLLOWUPS.md §6)
    // returns the same shape from real rows, with names already stripped on the server.
    case 'public_activity': {
      const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
      return json({
        delivered_total: 127,
        events: [
          { id: 'a1', kind: 'project_posted', category: 'coffee', city: 'Pasig City', at: minsAgo(3) },
          { id: 'a2', kind: 'quotes_received', category: 'bakery', city: 'Cebu City', quotes: 3, at: minsAgo(18) },
          { id: 'a3', kind: 'order_delivered', category: 'beauty', city: 'Quezon City', partner: 'Manila Offset Press', at: minsAgo(52) },
          { id: 'a4', kind: 'project_posted', category: 'food', city: 'Davao City', at: minsAgo(140) },
        ],
      });
    }

    case 'submit_project':
    case 'cancel_project': {
      const project = find('projects', args.p_project_id);
      if (!project) return json({ message: 'Project not found.' }, 404);
      if (name === 'cancel_project' && project.status === 'DRAFT') {
        TABLES.projects = TABLES.projects.filter((p) => p !== project);
      } else {
        project.status = name === 'submit_project' ? 'OPEN_FOR_QUOTES' : 'CANCELLED';
      }
      return json(project);
    }

    case 'submit_design_request':
    case 'cancel_design_request': {
      const request = find('design_requests', args.p_request_id);
      if (!request) return json({ message: 'Request not found.' }, 404);
      if (name === 'cancel_design_request' && request.status === 'DRAFT') {
        TABLES.design_requests = TABLES.design_requests.filter((r) => r !== request);
      } else {
        request.status = name === 'submit_design_request' ? 'OPEN_FOR_PROPOSALS' : 'CANCELLED';
      }
      return json(request);
    }

    case 'submit_quote':
    case 'withdraw_quote': {
      const quote = find('quotes', args.p_quote_id);
      if (!quote) return json({ message: 'Quotation not found.' }, 404);
      quote.status = name === 'submit_quote' ? 'SUBMITTED' : 'WITHDRAWN';
      const opp = TABLES.opportunities.find((o) => o.project_id === quote.project_id && o.partner_id === quote.partner_id);
      if (opp && name === 'submit_quote') opp.status = 'QUOTED';
      return json(quote);
    }

    case 'submit_design_proposal':
    case 'withdraw_design_proposal': {
      const proposal = find('design_proposals', args.p_proposal_id);
      if (!proposal) return json({ message: 'Proposal not found.' }, 404);
      proposal.status = name === 'submit_design_proposal' ? 'SUBMITTED' : 'WITHDRAWN';
      const opp = TABLES.design_opportunities.find((o) => o.request_id === proposal.request_id && o.designer_id === proposal.designer_id);
      if (opp && name === 'submit_design_proposal') opp.status = 'PROPOSED';
      return json(proposal);
    }

    case 'select_quote': {
      const quote = find('quotes', args.p_quote_id);
      if (!quote) return json({ message: 'Quotation not found.' }, 404);
      TABLES.quotes.filter((q) => q.project_id === quote.project_id && q.status === 'SUBMITTED').forEach((q) => (q.status = 'NOT_SELECTED'));
      quote.status = 'SELECTED';
      const project = find('projects', quote.project_id);
      if (project) project.status = 'PROVIDER_SELECTED';
      const order: Row = { id: newId('o'), project_id: quote.project_id, partner_id: quote.partner_id, customer_id: user?.id, quote_id: quote.id, status: 'AWAITING_PAYMENT', created_at: nowIso(), updated_at: nowIso(), delivered_at: null };
      TABLES.orders.push(order);
      addEvent('order_status_events', order.id, 'AWAITING_PAYMENT');
      TABLES.booking_payments.push({ id: newId('bp'), order_id: order.id, amount: Math.round(Number(quote.total_price) * 5) / 100, currency: 'PHP', status: 'pending', provider: 'paymongo', provider_checkout_id: null, created_at: nowIso(), updated_at: nowIso() });
      return json(order);
    }

    case 'select_design_proposal': {
      const proposal = find('design_proposals', args.p_proposal_id);
      if (!proposal) return json({ message: 'Proposal not found.' }, 404);
      TABLES.design_proposals.filter((p) => p.request_id === proposal.request_id && p.status === 'SUBMITTED').forEach((p) => (p.status = 'NOT_SELECTED'));
      proposal.status = 'SELECTED';
      const request = find('design_requests', proposal.request_id);
      if (request) request.status = 'DESIGNER_SELECTED';
      const order: Row = { id: newId('do'), request_id: proposal.request_id, designer_id: proposal.designer_id, customer_id: user?.id, proposal_id: proposal.id, status: 'AWAITING_PAYMENT', created_at: nowIso(), updated_at: nowIso(), delivered_at: null };
      TABLES.design_orders.push(order);
      addEvent('design_order_status_events', order.id, 'AWAITING_PAYMENT');
      TABLES.design_payments.push({ id: newId('dpay'), order_id: order.id, amount: Math.round(Number(proposal.price) * 5) / 100, currency: 'PHP', status: 'pending', provider: 'paymongo', provider_checkout_id: null, created_at: nowIso(), updated_at: nowIso() });
      return json(order);
    }

    case 'update_order_status': {
      const order = find('orders', args.p_order_id);
      if (!order) return json({ message: 'Order not found.' }, 404);
      order.status = args.p_status;
      order.updated_at = nowIso();
      addEvent('order_status_events', order.id, String(args.p_status), args.p_note);
      const project = find('projects', order.project_id);
      if (project) project.status = args.p_status === 'DELIVERED' ? 'DELIVERED' : args.p_status === 'READY' ? 'READY' : 'IN_PROGRESS';
      return json(order);
    }

    case 'update_design_order_status': {
      const order = find('design_orders', args.p_order_id);
      if (!order) return json({ message: 'Order not found.' }, 404);
      order.status = args.p_status;
      addEvent('design_order_status_events', order.id, String(args.p_status), args.p_note);
      return json(order);
    }

    case 'submit_design_deliverable': {
      const existing = TABLES.design_deliverables.filter((d) => d.order_id === args.p_order_id);
      const row: Row = { id: newId('dl'), order_id: args.p_order_id, revision_number: existing.length + 1, file_name: args.p_file_name, mime_type: args.p_mime_type ?? null, size_bytes: args.p_size_bytes ?? null, storage_path: args.p_storage_path, approved: false, approved_at: null, customer_feedback: null, uploaded_by: user?.id, created_at: nowIso() };
      TABLES.design_deliverables.push(row);
      const order = find('design_orders', args.p_order_id);
      if (order && order.status === 'CONFIRMED') {
        order.status = 'IN_PROGRESS';
        addEvent('design_order_status_events', order.id, 'IN_PROGRESS');
      }
      return json(row);
    }

    case 'review_design_deliverable': {
      const deliverable = find('design_deliverables', args.p_deliverable_id);
      if (!deliverable) return json({ message: 'Deliverable not found.' }, 404);
      deliverable.approved = Boolean(args.p_approved);
      deliverable.customer_feedback = args.p_feedback ?? null;
      if (args.p_approved) {
        deliverable.approved_at = nowIso();
        const order = find('design_orders', deliverable.order_id);
        if (order) {
          order.status = 'DELIVERED';
          addEvent('design_order_status_events', order.id, 'DELIVERED');
          const request = find('design_requests', order.request_id);
          if (request) request.status = 'DELIVERED';
        }
      }
      return json(deliverable);
    }

    case 'create_review':
    case 'create_design_review': {
      const design = name === 'create_design_review';
      const order = find(design ? 'design_orders' : 'orders', args.p_order_id);
      const row: Row = { id: newId('r'), order_id: args.p_order_id, rating: args.p_rating, comment: args.p_comment ?? null, would_work_again: args.p_would_work_again, hidden: false, hidden_reason: null, customer_id: user?.id, created_at: nowIso(), ...(design ? { designer_id: order?.designer_id, request_id: order?.request_id } : { partner_id: order?.partner_id, project_id: order?.project_id }) };
      TABLES[design ? 'design_reviews' : 'reviews'].push(row);
      return json(row);
    }

    case 'admin_set_account_status': {
      const profile = find('profiles', args.p_user_id);
      if (profile) profile.status = args.p_status;
      TABLES.partner_profiles.filter((p) => p.user_id === args.p_user_id).forEach((p) => (p.status = args.p_status));
      return json(null, 204);
    }

    case 'admin_moderate_review':
    case 'admin_moderate_design_review': {
      const review = find(name === 'admin_moderate_review' ? 'reviews' : 'design_reviews', args.p_review_id);
      if (review) {
        review.hidden = Boolean(args.p_hidden);
        review.hidden_reason = args.p_hidden ? args.p_reason : null;
      }
      return json(null, 204);
    }

    case 'admin_review_designer':
      TABLES.designer_admin_review_queue = TABLES.designer_admin_review_queue.filter((a) => a.id !== args.p_designer_id);
      return json(null, 204);

    default:
      return json(null, 204);
  }
}

/* ---------- Edge functions, sign-in and files ---------- */

function handleFunction(name: string, body: Row): Response {
  if (name === 'create-booking-checkout') {
    const suffix = body.kind === 'design' ? '?kind=design' : '';
    const table = body.kind === 'design' ? 'design_payments' : 'booking_payments';
    const payment = TABLES[table].find((p) => p.order_id === body.order_id);
    if (payment) payment.provider_checkout_id = `demo_${body.order_id}`;
    return json({ checkoutUrl: `${window.location.origin}/checkout/mock/${body.order_id}${suffix}`, mock: true });
  }
  if (name === 'paymongo-webhook') {
    const design = body.kind === 'design';
    const payment = TABLES[design ? 'design_payments' : 'booking_payments'].find((p) => p.provider_checkout_id === body.provider_checkout_id);
    if (payment) {
      payment.status = body.outcome === 'paid' ? 'paid' : 'failed';
      if (body.outcome === 'paid') {
        const order = find(design ? 'design_orders' : 'orders', payment.order_id);
        if (order) {
          order.status = 'CONFIRMED';
          addEvent(design ? 'design_order_status_events' : 'order_status_events', order.id, 'CONFIRMED');
        }
      }
    }
    return json({ ok: true });
  }
  // chat-assistant: fail on purpose, so the assistant shows its built-in scripted replies.
  return json({ error: 'Not available in demo mode' }, 500);
}

function handleAuth(path: string, method: string, url: URL, body: Row): Response {
  if (path.startsWith('/auth/v1/token')) {
    if (url.searchParams.get('grant_type') === 'password') {
      const role = Object.keys(USERS).find((r) => USERS[r].email === body.email) ?? 'customer';
      localStorage.setItem(DEMO_ROLE_KEY, role);
      return json(sessionFor(USERS[role]));
    }
    const user = currentUser();
    return user ? json(sessionFor(user)) : json({ error: 'invalid_grant' }, 400);
  }
  if (path.startsWith('/auth/v1/signup')) {
    const meta = ((body.data as Row | undefined) ?? {}) as Row;
    const role = typeof meta.role === 'string' && USERS[meta.role] ? meta.role : 'customer';
    localStorage.setItem(DEMO_ROLE_KEY, role);
    return json(sessionFor(USERS[role]));
  }
  if (path.startsWith('/auth/v1/logout')) {
    localStorage.removeItem(DEMO_ROLE_KEY);
    return json(null, 204);
  }
  if (path.startsWith('/auth/v1/user')) {
    const user = currentUser();
    return user ? json(sessionFor(user).user) : json({ message: 'Not signed in' }, 401);
  }
  if (method === 'POST') return json({});
  return json({});
}

function handleStorage(path: string, method: string): Response {
  if (path.includes('/object/sign/')) return json({ signedURL: '/object/public/demo/sample-file' });
  if (method === 'DELETE') return json([]);
  if (method === 'POST' || method === 'PUT') return json({ Key: path, Id: newId('file') });
  // Anything fetched as a "file" in the demo is this small stand-in image.
  return new Response(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#f6f5fa"/><text x="300" y="205" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#716b8c">Sample file (demo mode)</text></svg>',
    { status: 200, headers: { 'content-type': 'image/svg+xml' } },
  );
}

/* ---------- Install ---------- */

export function installDemoBackend() {
  restoreSnapshot();
  // Keep the pretend session in step with the chosen role.
  const role = localStorage.getItem(DEMO_ROLE_KEY);
  if (role && USERS[role]) localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionFor(USERS[role])));
  else localStorage.removeItem(STORAGE_KEY);

  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const href = request ? request.url : String(input);
    if (!href.startsWith(BASE)) return realFetch(input, init);

    const url = new URL(href);
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers ?? request?.headers);
    let body: unknown = null;
    const rawBody = init?.body ?? null;
    if (typeof rawBody === 'string') {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = null;
      }
    }

    // A short pause, so loading states are visible the way they are on a real connection.
    await new Promise((r) => setTimeout(r, 220));

    const path = url.pathname;
    // Anything that might have changed the sample data is followed by a save.
    if (method !== 'GET' && method !== 'HEAD') window.setTimeout(saveSnapshot, 0);
    if (path.startsWith('/rest/v1/rpc/')) return handleRpc(path.slice('/rest/v1/rpc/'.length), (body ?? {}) as Row);
    if (path.startsWith('/rest/v1/')) return handleRest(path.slice('/rest/v1/'.length), method, url, headers, body);
    if (path.startsWith('/auth/v1/')) return handleAuth(path, method, url, (body ?? {}) as Row);
    if (path.startsWith('/functions/v1/')) return handleFunction(path.slice('/functions/v1/'.length), (body ?? {}) as Row);
    if (path.startsWith('/storage/v1/')) return handleStorage(path, method);
    return json({});
  };
}
