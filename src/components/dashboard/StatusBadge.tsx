import { Badge, type BadgeTone } from '@/components/ui/bits';

type StatusMap = Record<string, { label: string; tone: BadgeTone }>;

const PROJECT: StatusMap = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  OPEN_FOR_QUOTES: { label: 'Open for quotes', tone: 'sun' },
  PROVIDER_SELECTED: { label: 'Provider selected', tone: 'cyan' },
  IN_PROGRESS: { label: 'In progress', tone: 'grape' },
  READY: { label: 'Ready', tone: 'magenta' },
  DELIVERED: { label: 'Delivered', tone: 'leaf' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

const ORDER: StatusMap = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'sun' },
  CONFIRMED: { label: 'Confirmed', tone: 'cyan' },
  IN_PRODUCTION: { label: 'In production', tone: 'grape' },
  READY: { label: 'Ready', tone: 'magenta' },
  DELIVERED: { label: 'Delivered', tone: 'leaf' },
};

const OFFER: StatusMap = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SUBMITTED: { label: 'Awaiting decision', tone: 'sun' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'muted' },
  SELECTED: { label: 'Selected', tone: 'leaf' },
  NOT_SELECTED: { label: 'Not selected', tone: 'muted' },
};

const OPPORTUNITY: StatusMap = {
  NEW: { label: 'New', tone: 'magenta' },
  VIEWED: { label: 'Viewed', tone: 'neutral' },
  QUOTED: { label: 'Quoted', tone: 'cyan' },
  DECLINED: { label: 'Declined', tone: 'muted' },
};

const DESIGN_REQUEST: StatusMap = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  OPEN_FOR_PROPOSALS: { label: 'Open for proposals', tone: 'sun' },
  DESIGNER_SELECTED: { label: 'Designer selected', tone: 'cyan' },
  IN_PROGRESS: { label: 'In progress', tone: 'grape' },
  DELIVERED: { label: 'Delivered', tone: 'leaf' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

const DESIGN_ORDER: StatusMap = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'sun' },
  CONFIRMED: { label: 'Confirmed', tone: 'cyan' },
  IN_PROGRESS: { label: 'In progress', tone: 'grape' },
  DELIVERED: { label: 'Delivered', tone: 'leaf' },
};

const DESIGN_OPPORTUNITY: StatusMap = {
  NEW: { label: 'New', tone: 'magenta' },
  VIEWED: { label: 'Viewed', tone: 'neutral' },
  PROPOSED: { label: 'Proposed', tone: 'cyan' },
  DECLINED: { label: 'Declined', tone: 'muted' },
};

const ACCOUNT: StatusMap = {
  active: { label: 'Active', tone: 'leaf' },
  suspended: { label: 'Suspended', tone: 'danger' },
  pending_review: { label: 'Pending review', tone: 'sun' },
  rejected: { label: 'Rejected', tone: 'muted' },
};

function render(map: StatusMap, status: string) {
  const entry = map[status];
  return <Badge tone={entry?.tone ?? 'neutral'}>{entry?.label ?? status}</Badge>;
}

export const ProjectStatusBadge = ({ status }: { status: string }) => render(PROJECT, status);
export const OrderStatusBadge = ({ status }: { status: string }) => render(ORDER, status);
export const QuoteStatusBadge = ({ status }: { status: string }) => render(OFFER, status);
export const OpportunityStatusBadge = ({ status }: { status: string }) => render(OPPORTUNITY, status);
export const DesignRequestStatusBadge = ({ status }: { status: string }) => render(DESIGN_REQUEST, status);
export const DesignOrderStatusBadge = ({ status }: { status: string }) => render(DESIGN_ORDER, status);
export const DesignProposalStatusBadge = ({ status }: { status: string }) => render(OFFER, status);
export const DesignOpportunityStatusBadge = ({ status }: { status: string }) => render(DESIGN_OPPORTUNITY, status);
export const AccountStatusBadge = ({ status }: { status: string }) => render(ACCOUNT, status);
