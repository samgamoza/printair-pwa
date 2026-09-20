/**
 * Email bodies for each notification kind.
 *
 * Deliberately plain: a short subject, one sentence of context, one link. These
 * are transactional nudges telling someone something happened on PrintAir —
 * they are not marketing, and every extra element is another thing to render
 * badly in a Philippine inbox on a phone.
 *
 * Every message ships both html and text. Text-only clients are still common,
 * and a missing plain-text part measurably hurts spam scoring.
 */

export type NotificationKind =
  // print marketplace
  | 'OPPORTUNITY_RECEIVED'
  | 'QUOTE_RECEIVED'
  | 'QUOTE_SELECTED'
  | 'ORDER_STATUS_CHANGED'
  | 'PAYMENT_CONFIRMED'
  // designer marketplace (20260813000100_designer_notifications.sql)
  | 'DESIGN_OPPORTUNITY_RECEIVED'
  | 'DESIGN_PROPOSAL_RECEIVED'
  | 'DESIGN_PROPOSAL_SELECTED'
  | 'DESIGN_ORDER_STATUS_CHANGED'
  | 'DESIGN_DELIVERABLE_SUBMITTED'
  | 'DESIGN_REVISION_REQUESTED'
  | 'DESIGNER_APPLICATION_REVIEWED';

export type Rendered = { subject: string; html: string; text: string };

const BRAND = '#E2632A';

function peso(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(opts: { heading: string; body: string; cta: string; url: string }): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F6F3EE;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1C1917">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <div style="font-weight:700;font-size:15px;letter-spacing:.02em;color:${BRAND};margin-bottom:24px">PrintAir</div>
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${opts.heading}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#44403C">${opts.body}</p>
    <a href="${opts.url}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">${opts.cta}</a>
    <p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#A8A29E">
      You are receiving this because you have a PrintAir account.
    </p>
  </div>
</body></html>`;
}

function plain(heading: string, body: string, cta: string, url: string): string {
  return `${heading}\n\n${body}\n\n${cta}: ${url}\n\n—\nYou are receiving this because you have a PrintAir account.`;
}

/**
 * `payload` is whatever the trigger stored. Fields are read defensively — a
 * template must never throw and strand a notification in PENDING forever.
 */
export function render(
  kind: NotificationKind,
  payload: Record<string, unknown>,
  siteUrl: string,
): Rendered {
  const url = `${siteUrl.replace(/\/$/, '')}${String(payload.path ?? '/')}`;
  const title = esc(payload.project_title ?? 'your project');

  switch (kind) {
    case 'OPPORTUNITY_RECEIVED': {
      const heading = 'A new project matches your capabilities';
      const body = `<strong>${title}</strong> was just opened for quotes in ${esc(payload.category ?? 'your category')}. Review the brief and send a quotation — projects are shown to every matching partner, so the earlier you respond the better.`;
      return {
        subject: `New project to quote: ${payload.project_title ?? 'PrintAir'}`,
        html: layout({ heading, body, cta: 'View the brief', url }),
        text: plain(
          heading,
          `${payload.project_title ?? 'A project'} was just opened for quotes. Review the brief and send a quotation.`,
          'View the brief',
          url,
        ),
      };
    }

    case 'QUOTE_RECEIVED': {
      const partner = esc(payload.partner_name ?? 'A printing partner');
      const price = peso(payload.total_price);
      const heading = 'You have a new quotation';
      const body = `${partner} quoted <strong>${title}</strong>${price ? ` at <strong>${price}</strong>` : ''}. Compare it against any others before choosing — you are not committed to anything yet.`;
      return {
        subject: `${partner} quoted ${payload.project_title ?? 'your project'}`,
        html: layout({ heading, body, cta: 'Compare quotations', url }),
        text: plain(
          heading,
          `${partner} quoted ${payload.project_title ?? 'your project'}${price ? ` at ${price}` : ''}.`,
          'Compare quotations',
          url,
        ),
      };
    }

    case 'QUOTE_SELECTED': {
      const price = peso(payload.total_price);
      const heading = 'Your quotation was accepted';
      const body = `The customer chose your quotation for <strong>${title}</strong>${price ? ` at <strong>${price}</strong>` : ''}. The order opens once they have settled PrintAir's platform fee — we will let you know the moment it is confirmed.`;
      return {
        subject: `You won the job: ${payload.project_title ?? 'PrintAir project'}`,
        html: layout({ heading, body, cta: 'View the order', url }),
        text: plain(
          heading,
          `The customer chose your quotation for ${payload.project_title ?? 'a project'}${price ? ` at ${price}` : ''}.`,
          'View the order',
          url,
        ),
      };
    }

    case 'PAYMENT_CONFIRMED': {
      const heading = 'Your order is confirmed';
      const body = `We have received the platform fee for <strong>${title}</strong> and your printing partner has been notified. They will begin production and update you as it progresses.`;
      return {
        subject: `Order confirmed: ${payload.project_title ?? 'your project'}`,
        html: layout({ heading, body, cta: 'Track your order', url }),
        text: plain(heading, `The platform fee for ${payload.project_title ?? 'your project'} is settled and your partner has been notified.`, 'Track your order', url),
      };
    }

    case 'ORDER_STATUS_CHANGED': {
      const readable: Record<string, string> = {
        AWAITING_PAYMENT: 'awaiting payment',
        CONFIRMED: 'confirmed',
        IN_PRODUCTION: 'in production',
        READY: 'ready',
        DELIVERED: 'delivered',
      };
      const to = readable[String(payload.to_status)] ?? String(payload.to_status ?? 'updated');
      const heading = `Your order is now ${to}`;
      const body = `<strong>${title}</strong> moved to <strong>${esc(to)}</strong>.`;
      return {
        subject: `${payload.project_title ?? 'Your order'} is now ${to}`,
        html: layout({ heading, body, cta: 'Track your order', url }),
        text: plain(heading, `${payload.project_title ?? 'Your order'} moved to ${to}.`, 'Track your order', url),
      };
    }

    // -----------------------------------------------------------------------
    // Designer marketplace.
    //
    // Separate cases rather than shared ones with print: the nouns differ all
    // the way down (request not project, proposal not quotation, designer not
    // printing partner), and a message that calls a designer a "printing
    // partner" reads as sent to the wrong person.
    // -----------------------------------------------------------------------

    case 'DESIGN_OPPORTUNITY_RECEIVED': {
      const reqTitle = esc(payload.request_title ?? 'a design request');
      const heading = 'A new design request matches your specialties';
      const body = `<strong>${reqTitle}</strong> is open for proposals. Review the brief and send yours — requests go to every matching designer, so responding early helps.`;
      return {
        subject: `New design request: ${payload.request_title ?? 'PrintAir'}`,
        html: layout({ heading, body, cta: 'View the brief', url }),
        text: plain(heading, `${payload.request_title ?? 'A design request'} is open for proposals.`, 'View the brief', url),
      };
    }

    case 'DESIGN_PROPOSAL_RECEIVED': {
      const designer = esc(payload.designer_name ?? 'A designer');
      const reqTitle = esc(payload.request_title ?? 'your design request');
      const price = peso(payload.price);
      const heading = 'You have a new design proposal';
      const body = `${designer} proposed on <strong>${reqTitle}</strong>${price ? ` at <strong>${price}</strong>` : ''}. Compare it against any others before choosing — you are not committed to anything yet.`;
      return {
        subject: `${designer} proposed on ${payload.request_title ?? 'your design request'}`,
        html: layout({ heading, body, cta: 'Compare proposals', url }),
        text: plain(heading, `${designer} proposed${price ? ` at ${price}` : ''}.`, 'Compare proposals', url),
      };
    }

    case 'DESIGN_PROPOSAL_SELECTED': {
      const reqTitle = esc(payload.request_title ?? 'a design request');
      const price = peso(payload.price);
      const heading = 'Your proposal was accepted';
      const body = `The customer chose you for <strong>${reqTitle}</strong>${price ? ` at <strong>${price}</strong>` : ''}. The commission opens once they have settled PrintAir's platform fee — we will tell you the moment it is confirmed and you can start.`;
      return {
        subject: `You won the commission: ${payload.request_title ?? 'PrintAir'}`,
        html: layout({ heading, body, cta: 'View the commission', url }),
        text: plain(heading, `The customer chose you for ${payload.request_title ?? 'a design request'}${price ? ` at ${price}` : ''}.`, 'View the commission', url),
      };
    }

    case 'DESIGN_ORDER_STATUS_CHANGED': {
      const reqTitle = esc(payload.request_title ?? 'your design request');
      const status = String(payload.status ?? '');

      // CONFIRMED is the payment moment, so it gets its own copy rather than
      // the generic "moved to confirmed".
      if (status === 'CONFIRMED') {
        const heading = 'Your commission is confirmed';
        const body = `We have received the platform fee for <strong>${reqTitle}</strong> and your designer has been notified. They will start work and upload the first draft for your review.`;
        return {
          subject: `Commission confirmed: ${payload.request_title ?? 'your design request'}`,
          html: layout({ heading, body, cta: 'Track your commission', url }),
          text: plain(heading, `The platform fee for ${payload.request_title ?? 'your design request'} is settled and your designer has been notified.`, 'Track your commission', url),
        };
      }

      const readable: Record<string, string> = {
        AWAITING_PAYMENT: 'awaiting payment',
        IN_PROGRESS: 'in progress',
        DELIVERED: 'delivered',
      };
      const to = readable[status] ?? (status || 'updated');
      const heading = `Your commission is now ${to}`;
      const body = `<strong>${reqTitle}</strong> moved to <strong>${esc(to)}</strong>.`;
      return {
        subject: `${payload.request_title ?? 'Your commission'} is now ${to}`,
        html: layout({ heading, body, cta: 'Track your commission', url }),
        text: plain(heading, `${payload.request_title ?? 'Your commission'} moved to ${to}.`, 'Track your commission', url),
      };
    }

    case 'DESIGN_DELIVERABLE_SUBMITTED': {
      const reqTitle = esc(payload.request_title ?? 'your design request');
      const rev = Number(payload.revision_number);
      const revLabel = Number.isFinite(rev) ? `Revision ${rev}` : 'A new revision';
      const heading = 'A new draft is ready for review';
      const body = `${revLabel} of <strong>${reqTitle}</strong> has been uploaded. Download it and either approve it or send it back with notes on what to change.`;
      return {
        subject: `New draft ready: ${payload.request_title ?? 'your design request'}`,
        html: layout({ heading, body, cta: 'Review the draft', url }),
        text: plain(heading, `${revLabel} of ${payload.request_title ?? 'your design request'} is ready to review.`, 'Review the draft', url),
      };
    }

    case 'DESIGN_REVISION_REQUESTED': {
      const reqTitle = esc(payload.request_title ?? 'a commission');
      const feedback = esc(payload.feedback ?? '');
      const heading = 'The customer asked for changes';
      const body = `Your draft for <strong>${reqTitle}</strong> came back with notes.${feedback ? ` They wrote: <em>“${feedback}”</em>` : ''} Upload the next revision when it is ready.`;
      return {
        subject: `Changes requested: ${payload.request_title ?? 'PrintAir commission'}`,
        html: layout({ heading, body, cta: 'Open the commission', url }),
        text: plain(heading, `Your draft for ${payload.request_title ?? 'a commission'} came back with notes.${payload.feedback ? ` They wrote: "${payload.feedback}"` : ''}`, 'Open the commission', url),
      };
    }

    case 'DESIGNER_APPLICATION_REVIEWED': {
      const approved = String(payload.decision ?? '') === 'active';
      const reason = esc(payload.reason ?? '');

      if (approved) {
        const heading = 'Your designer application was approved';
        const body = `Welcome to PrintAir. Your job board is open — design requests matching your specialties will start arriving, and you can send proposals straight away.`;
        return {
          subject: 'You are approved to design on PrintAir',
          html: layout({ heading, body, cta: 'Open your workspace', url }),
          text: plain(heading, 'Your job board is open and matching requests will start arriving.', 'Open your workspace', url),
        };
      }

      const heading = 'An update on your designer application';
      const body = `We are not able to approve your application at this time.${reason ? ` The reviewer noted: <em>“${reason}”</em>` : ''} If you would like to discuss it, reply to this email and a person will read it.`;
      return {
        subject: 'Your PrintAir designer application',
        html: layout({ heading, body, cta: 'View your account', url }),
        text: plain(heading, `We are not able to approve your application at this time.${payload.reason ? ` The reviewer noted: "${payload.reason}"` : ''}`, 'View your account', url),
      };
    }
  }
}
