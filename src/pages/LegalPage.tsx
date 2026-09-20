import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/shell/PublicShell';
import { Banner } from '@/components/ui/states';
import { LEGAL } from '@/data/legal';
import { BOOKING_FEE_PCT } from '@/lib/pricing';

/**
 * Privacy Policy and Terms of Use.
 *
 * Plain-language drafts that describe what the app really does. The facts only the owner knows
 * (company name, address, contact, refund rule) come from src/data/legal.ts — see the note there
 * about review before launch.
 */

type Section = { title: string; body: ReactNode };

const contact = LEGAL.email ? (
  <a className="font-bold text-magenta-700 underline" href={`mailto:${LEGAL.email}`}>
    {LEGAL.email}
  </a>
) : (
  'the contact details on this page'
);

const PRIVACY: Section[] = [
  {
    title: 'Who we are',
    body: (
      <p>
        {LEGAL.operator} runs the PrintAir marketplace, which connects people who need printing, packaging or design with printing partners
        and designers in the Philippines. {LEGAL.operator} decides how your personal information is used here, which makes it the
        &ldquo;personal information controller&rdquo; under the Data Privacy Act of 2012.
      </p>
    ),
  },
  {
    title: 'What we collect',
    body: (
      <ul>
        <li>
          <b>Your account:</b> email address, name, mobile number if you give one, password (stored only in scrambled form) and whether you are a customer, printing
          partner, designer or administrator.
        </li>
        <li>
          <b>Business and designer profiles:</b> business or display name, location, services, capabilities, portfolio samples and anything
          else you add to your public profile.
        </li>
        <li>
          <b>Projects and design requests:</b> what you want made, quantities, sizes, materials, deadlines, delivery location, notes, and the
          artwork or reference files you upload.
        </li>
        <li>
          <b>Quotations, proposals, questions and order updates</b> exchanged between customers, partners and designers.
        </li>
        <li>
          <b>Reviews</b> you write about a completed order.
        </li>
        <li>
          <b>Payments:</b> the amount, status and reference of each platform fee. Card and e-wallet details are entered on PayMongo&apos;s
          pages and never reach PrintAir.
        </li>
        <li>
          <b>Assistant chats:</b> what you type to the PrintAir Assistant, so it can answer.
        </li>
        <li>
          <b>On your device:</b> small settings saved in your browser, such as staying signed in and whether you dismissed the install
          banner, plus a copy of the screens you last viewed so the app still opens on a weak connection. That copy never leaves your
          device and is erased when you sign out. PrintAir has no advertising trackers.
        </li>
      </ul>
    ),
  },
  {
    title: 'Why we use it',
    body: (
      <p>
        To run your account; to show your project to printing partners or designers so they can quote; to let you compare offers, confirm an
        order, pay the platform fee and follow the order to delivery; to send you emails about those orders; to vet partners and designers;
        to keep the marketplace safe; and to meet legal and tax obligations.
      </p>
    ),
  },
  {
    title: 'Who can see what',
    body: (
      <ul>
        <li>
          <b>Printing partners</b> see the brief of a project that is open for quotations. Your uploaded artwork can be downloaded only by
          the partner you choose.
        </li>
        <li>
          <b>Designers</b> who are sent your design request see its brief and the reference files you attached, so they can propose.
        </li>
        <li>
          <b>Customers</b> see the offers made to them, and the public profile and reviews of whoever made them.
        </li>
        <li>
          <b>Everyone</b> can see public partner and designer profiles and published reviews.
        </li>
        <li>
          <b>PrintAir administrators</b> can see accounts, projects, offers and reviews in order to run and moderate the marketplace.
        </li>
        <li>
          <b>Service providers</b> that process data for us: Supabase (database, sign-in and file storage), PayMongo (payments), our email
          delivery provider, and the AI service that powers the Assistant. Some of these store data outside the Philippines.
        </li>
      </ul>
    ),
  },
  {
    title: 'How long we keep it',
    body: (
      <p>
        For as long as your account is open, and afterwards only as long as the law requires, for example for payment and tax records. You
        can ask us to delete your account at any time.
      </p>
    ),
  },
  {
    title: 'Your rights',
    body: (
      <p>
        Under the Data Privacy Act you may ask what we hold about you, get a copy, have it corrected, object to or withdraw consent for a use,
        and ask for it to be erased or blocked. Write to {contact}. If you are not satisfied with our answer you may complain to the National
        Privacy Commission.
      </p>
    ),
  },
  {
    title: 'Changes',
    body: <p>When this policy changes we will update the date above, and tell you in the app or by email if the change is significant.</p>,
  },
];

const TERMS: Section[] = [
  {
    title: 'What PrintAir is',
    body: (
      <p>
        PrintAir is a marketplace. Customers post print, packaging and design work; vetted printing partners and designers make offers; the
        customer chooses one. The agreement to produce and deliver the work is between the customer and the partner or designer they choose.{' '}
        {LEGAL.operator} provides the platform and is not the manufacturer or the designer.
      </p>
    ),
  },
  {
    title: 'Your account',
    body: (
      <p>
        Give accurate information, keep your password to yourself, and tell us if you think someone else has used your account. Printing partners and
        designers are reviewed before they can make offers, and may be suspended if they stop meeting the marketplace&apos;s standards.
      </p>
    ),
  },
  {
    title: 'Fees and payment',
    body: (
      <>
        <p>
          Posting a project and receiving offers is free. When a customer chooses an offer, PrintAir charges a platform fee of {BOOKING_FEE_PCT}
          % of the chosen price to confirm the order. It is paid through PayMongo, and the exact amount is shown before you pay.
        </p>
        <p>
          For printing work, the price of the job itself is separate and is paid directly to the printing partner, on the terms the two of you
          agree.
        </p>
        <p>
          {LEGAL.refundPolicy ||
            'If an order is cancelled or cannot be fulfilled, contact us about the platform fee and we will review the request.'}
        </p>
      </>
    ),
  },
  {
    title: 'Your files and content',
    body: (
      <p>
        You keep ownership of what you upload. You confirm you have the right to use it, including any logos, photos and fonts, and you allow
        PrintAir to store it and show it to the people involved in your order. Who owns a commissioned design once it is approved is agreed
        between the customer and the designer.
      </p>
    ),
  },
  {
    title: 'Fair use',
    body: (
      <p>
        Do not post unlawful, infringing or misleading content, send offers you do not intend to honour, or interfere with the service. Reviews must describe a real order and be your own honest opinion.
      </p>
    ),
  },
  {
    title: 'If something goes wrong',
    body: (
      <p>
        Tell the other party first through the order page, then tell us. We will help where we can, but quality, timing and delivery are the
        responsibility of the partner or designer you chose. Nothing in these terms takes away rights you have under Philippine consumer
        law.
      </p>
    ),
  },
  {
    title: 'The service',
    body: (
      <p>
        We work to keep PrintAir available and accurate, but it is provided as it is, and features may change. To the extent the law allows,{' '}
        {LEGAL.operator} is not liable for indirect losses or for the acts of other users. These terms are governed by the laws of the
        Republic of the Philippines.
      </p>
    ),
  },
];

const DOCS = {
  privacy: { title: 'Privacy Policy', lead: 'What PrintAir knows about you, why, and who else sees it.', sections: PRIVACY, other: { to: '/terms', label: 'Terms of Use' } },
  terms: { title: 'Terms of Use', lead: 'The ground rules for using PrintAir.', sections: TERMS, other: { to: '/privacy', label: 'Privacy Policy' } },
};

export default function LegalPage({ doc }: { doc: keyof typeof DOCS }) {
  const d = DOCS[doc];
  return (
    <PublicShell back={{ to: '/', label: 'Back to PrintAir' }} width="max-w-3xl">
      <article className="pb-16">
        <p className="slug text-ink-500">Last updated {LEGAL.updated}</p>
        <h1 className="mt-2 text-4xl text-ink-950 sm:text-5xl">{d.title}</h1>
        <p className="mt-3 text-lg text-ink-600">{d.lead}</p>

        {!LEGAL.reviewed && (
          <Banner tone="warning" className="mt-6">
            Draft. This page is being finalised and is not yet PrintAir&apos;s official {d.title.toLowerCase()}.
          </Banner>
        )}

        <div className="mt-8 space-y-4">
          {d.sections.map((s, i) => (
            <section key={s.title} className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink-900/5 sm:p-7">
              <h2 className="text-xl text-ink-950">
                <span className="mr-2 text-ink-400">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-ink-700 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">{s.body}</div>
            </section>
          ))}

          <section className="rounded-3xl bg-ink-950 p-6 text-white sm:p-7">
            <h2 className="text-xl">Contact</h2>
            <p className="mt-3 text-white/75">
              {LEGAL.operator}
              {LEGAL.address ? `, ${LEGAL.address}` : ''}
              {LEGAL.email ? (
                <>
                  {' · '}
                  <a className="font-bold text-white underline" href={`mailto:${LEGAL.email}`}>
                    {LEGAL.email}
                  </a>
                </>
              ) : null}
            </p>
            <Link to={d.other.to} className="mt-4 inline-block font-bold text-sun-300 underline">
              Read the {d.other.label}
            </Link>
          </section>
        </div>
      </article>
    </PublicShell>
  );
}
