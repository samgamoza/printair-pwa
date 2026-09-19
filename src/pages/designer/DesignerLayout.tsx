import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Home, Inbox, Package, UserCircle } from 'lucide-react';
import { AppShell, type ShellNavItem } from '@/components/shell/AppShell';
import { Banner } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { getDesignerOpportunities } from '@/lib/api/designer';
import { getDesignerOrders } from '@/lib/api/designOrders';

/**
 * Designer workspace shell.
 *
 * The one thing this does that PartnerLayout does not is take the approval
 * gate seriously. A designer sits at 'pending_review' until an admin decides,
 * and during that time they have no opportunities and no way to earn — showing
 * them an empty job board would read as "nobody wants you" rather than "we
 * have not finished reviewing you". The banner says which it is.
 */
export default function DesignerLayout() {
  const { designerProfile } = useAuth();
  const location = useLocation();
  const [newOpportunities, setNewOpportunities] = useState(0);
  const [readyToUpdate, setReadyToUpdate] = useState(0);

  const approved = designerProfile?.status === 'active';

  const refreshCounts = useCallback(() => {
    if (!designerProfile || !approved) return;
    getDesignerOpportunities(designerProfile.id)
      .then((opps) => setNewOpportunities(opps.filter((o) => o.status === 'NEW').length))
      .catch(() => setNewOpportunities(0));
    getDesignerOrders(designerProfile.id)
      .then((orders) => setReadyToUpdate(orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'IN_PROGRESS').length))
      .catch(() => setReadyToUpdate(0));
  }, [designerProfile, approved]);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    if (location.pathname === '/designer') refreshCounts();
  }, [location.pathname, refreshCounts]);

  const nav: ShellNavItem[] = useMemo(
    () => [
      { to: '/designer', label: 'Home', icon: Home, end: true },
      { to: '/designer/opportunities', label: 'Job Board', short: 'Jobs', icon: Inbox, count: newOpportunities },
      { to: '/designer/orders', label: 'My Orders', short: 'Orders', icon: Package, count: readyToUpdate },
      { to: '/designer/profile', label: 'My Profile', short: 'Profile', icon: UserCircle },
    ],
    [newOpportunities, readyToUpdate],
  );

  return (
    <AppShell
      navItems={nav}
      roleLabel="Designer"
      banner={<StatusBanner status={designerProfile?.status} reason={designerProfile?.review_reason} />}
    >
      <Outlet />
    </AppShell>
  );
}

function StatusBanner({ status, reason }: { status?: string; reason?: string | null }) {
  if (!status || status === 'active') return null;

  if (status === 'pending_review') {
    return (
      <div className="mx-auto max-w-5xl px-5 pt-4 sm:px-8">
        <Banner tone="warning">
          Your application is being reviewed. Adding portfolio samples helps — work starts arriving once you are approved.
        </Banner>
      </div>
    );
  }

  const isRejected = status === 'rejected';
  return (
    <div className="mx-auto max-w-5xl px-5 pt-4 sm:px-8">
      <Banner tone="danger">
        {isRejected ? 'Your application was not approved.' : 'Your designer account is suspended.'}
        {reason ? ` ${reason}` : ''} Contact PrintAir support if you would like to discuss it.
      </Banner>
    </div>
  );
}
