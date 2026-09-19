import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Inbox, FileText, Package, PackageCheck, Building2, Settings } from 'lucide-react';
import { AppShell, type ShellNavItem } from '@/components/shell/AppShell';
import { Banner } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { getPartnerCapabilities, isProfileComplete } from '@/lib/api/partner';
import { getPartnerOpportunities } from '@/lib/api/opportunities';
import { getPartnerOrders } from '@/lib/api/orders';

export default function PartnerLayout() {
  const { partnerProfile } = useAuth();
  const location = useLocation();
  const [complete, setComplete] = useState(true);
  const [newOpportunities, setNewOpportunities] = useState(0);
  const [readyToUpdate, setReadyToUpdate] = useState(0);

  // Simple in-app status indicators — counts only, no push/email, no
  // polling. Refreshed on entry and whenever the partner returns to Home,
  // since that's the natural moment they'd expect the sidebar to catch up
  // (e.g. after opening opportunities that just flipped NEW -> VIEWED).
  const refreshCounts = useCallback(() => {
    if (!partnerProfile) return;
    Promise.all([getPartnerOpportunities(partnerProfile.id), getPartnerOrders(partnerProfile.id)]).then(
      ([opps, orders]) => {
        setNewOpportunities(opps.filter((o) => o.status === 'NEW').length);
        setReadyToUpdate(orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'IN_PRODUCTION').length);
      },
    );
  }, [partnerProfile]);

  useEffect(() => {
    if (!partnerProfile) return;
    getPartnerCapabilities(partnerProfile.id).then((caps) => {
      setComplete(isProfileComplete(partnerProfile, caps));
    });
    refreshCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerProfile]);

  useEffect(() => {
    if (location.pathname === '/partner') refreshCounts();
  }, [location.pathname, refreshCounts]);

  const nav: ShellNavItem[] = useMemo(
    () => [
      { to: '/partner', label: 'Home', short: 'Home', icon: Home, end: true },
      { to: '/partner/opportunities', label: 'New Opportunities', short: 'New', icon: Inbox, count: newOpportunities },
      { to: '/partner/quotes', label: 'My Quotations', short: 'Quotes', icon: FileText },
      { to: '/partner/projects', label: 'Active Projects', short: 'Active', icon: Package, count: readyToUpdate },
      { to: '/partner/completed', label: 'Completed Projects', short: 'Done', icon: PackageCheck },
      { to: '/partner/profile', label: 'Business Profile', short: 'Profile', icon: Building2 },
      { to: '/partner/settings', label: 'Settings', short: 'Settings', icon: Settings },
    ],
    [newOpportunities, readyToUpdate],
  );

  return (
    <AppShell
      navItems={nav}
      roleLabel="Printing partner"
      banner={
        !complete ? (
          <div className="mx-auto max-w-5xl px-5 pt-4 sm:px-8">
            <Banner
              tone="warning"
              action={
                <Link
                  to="/partner/profile"
                  className="-my-1 inline-flex min-h-11 items-center font-extrabold text-ink-950 underline decoration-2 underline-offset-4 hover:no-underline"
                >
                  Complete profile
                </Link>
              }
            >
              Complete your business profile to receive better-matched project opportunities.
            </Banner>
          </div>
        ) : null
      }
    >
      <Outlet />
    </AppShell>
  );
}
