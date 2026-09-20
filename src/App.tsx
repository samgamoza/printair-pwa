import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import AppEntry from '@/pwa/AppEntry';
import OfflinePage from '@/pwa/OfflinePage';
import { UpdateToast } from '@/pwa/UpdateToast';
import { StaleStrip } from '@/pwa/StaleStrip';
import { AuthModal } from '@/components/auth/AuthModal';
import { PageLoader } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { whenIdleAndUnconstrained } from '@/pwa/connection';

// Every screen except the welcome page loads on demand, so a customer never downloads the partner,
// designer or admin areas. The service worker still precaches all of them, so they open offline too.
const DesignLandingPage = lazy(() => import('@/pages/DesignLandingPage'));
const DesignerLayout = lazy(() => import('@/pages/designer/DesignerLayout'));
const DesignerHomePage = lazy(() => import('@/pages/designer/DesignerHomePage'));
const DesignerOpportunitiesPage = lazy(() => import('@/pages/designer/DesignerOpportunitiesPage'));
const DesignerOpportunityDetailPage = lazy(() => import('@/pages/designer/DesignerOpportunityDetailPage'));
const DesignerOrdersPage = lazy(() => import('@/pages/designer/DesignerOrdersPage'));
const DesignerProfilePage = lazy(() => import('@/pages/designer/DesignerProfilePage'));
const LegalPage = lazy(() => import('@/pages/LegalPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const MockCheckoutPage = lazy(() => import('@/pages/checkout/MockCheckoutPage'));
const CheckoutReturnPage = lazy(() => import('@/pages/checkout/CheckoutReturnPage'));
const PartnerDirectoryPage = lazy(() => import('@/pages/PartnerDirectoryPage'));
const PartnerPublicProfilePage = lazy(() => import('@/pages/PartnerPublicProfilePage'));
const DesignerDirectoryPage = lazy(() => import('@/pages/DesignerDirectoryPage'));
const DesignerPublicProfilePage = lazy(() => import('@/pages/DesignerPublicProfilePage'));
const CustomerLayout = lazy(() => import('@/pages/customer/CustomerLayout'));
const ProjectsListPage = lazy(() => import('@/pages/customer/ProjectsListPage'));
const ProjectDetailPage = lazy(() => import('@/pages/customer/ProjectDetailPage'));
const DesignRequestsListPage = lazy(() => import('@/pages/customer/DesignRequestsListPage'));
const DesignRequestDetailPage = lazy(() => import('@/pages/customer/DesignRequestDetailPage'));
const PartnerLayout = lazy(() => import('@/pages/partner/PartnerLayout'));
const PartnerHomePage = lazy(() => import('@/pages/partner/PartnerHomePage'));
const OpportunitiesPage = lazy(() => import('@/pages/partner/OpportunitiesPage'));
const OpportunityDetailPage = lazy(() => import('@/pages/partner/OpportunityDetailPage'));
const MyQuotationsPage = lazy(() => import('@/pages/partner/MyQuotationsPage'));
const ActiveProjectsPage = lazy(() => import('@/pages/partner/ActiveProjectsPage'));
const CompletedProjectsPage = lazy(() => import('@/pages/partner/CompletedProjectsPage'));
const BusinessProfilePage = lazy(() => import('@/pages/partner/BusinessProfilePage'));
const PartnerSettingsPage = lazy(() => import('@/pages/partner/PartnerSettingsPage'));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminProvidersPage = lazy(() => import('@/pages/admin/AdminProvidersPage'));
const AdminDesignersPage = lazy(() => import('@/pages/admin/AdminDesignersPage'));
const AdminProjectsPage = lazy(() => import('@/pages/admin/AdminProjectsPage'));
const AdminQuotesPage = lazy(() => import('@/pages/admin/AdminQuotesPage'));
const AdminReviewsPage = lazy(() => import('@/pages/admin/AdminReviewsPage'));
const AdminDesignReviewsPage = lazy(() => import('@/pages/admin/AdminDesignReviewsPage'));
/**
 * design.guma.one is the designer front door.
 *
 * Per the feature plan it is a route inside this app, not a separate build —
 * same auth, same database, same deploy. Only the root differs: on that host
 * `/` is the designer landing page instead of the customer one. Every other
 * route is shared, so a designer can be linked straight to /designer from
 * either hostname.
 */
/**
 * The screens each kind of account opens most. Once we know who is signed in, their code is fetched
 * while the browser is idle, so moving between tabs never waits on the network — the first visit
 * included, before the service worker has finished saving the whole app. Skipped on data-saving and
 * 2G connections.
 */
const ROLE_SCREENS: Record<string, (() => Promise<unknown>)[]> = {
  customer: [
    () => import('@/pages/customer/CustomerLayout'),
    () => import('@/pages/customer/ProjectsListPage'),
    () => import('@/pages/customer/ProjectDetailPage'),
    () => import('@/pages/customer/DesignRequestsListPage'),
    () => import('@/components/ProjectBuilder'),
  ],
  partner: [
    () => import('@/pages/partner/PartnerLayout'),
    () => import('@/pages/partner/PartnerHomePage'),
    () => import('@/pages/partner/OpportunitiesPage'),
    () => import('@/pages/partner/OpportunityDetailPage'),
    () => import('@/pages/partner/ActiveProjectsPage'),
    () => import('@/pages/partner/MyQuotationsPage'),
  ],
  designer: [
    () => import('@/pages/designer/DesignerLayout'),
    () => import('@/pages/designer/DesignerHomePage'),
    () => import('@/pages/designer/DesignerOpportunitiesPage'),
    () => import('@/pages/designer/DesignerOrdersPage'),
  ],
  admin: [() => import('@/pages/admin/AdminLayout'), () => import('@/pages/admin/AdminUsersPage')],
};

function isDesignerHost() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('design.');
}

export default function App() {
  const designerFrontDoor = isDesignerHost();
  const role = useAuth().profile?.role;

  useEffect(() => {
    if (!role) return;
    whenIdleAndUnconstrained(() => ROLE_SCREENS[role]?.forEach((load) => void load().catch(() => {})));
  }, [role]);

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={designerFrontDoor ? <DesignLandingPage /> : <LandingPage />} />
          {/* Reachable from the main host too, so the designer pitch can be linked. */}
          <Route path="/design" element={<DesignLandingPage />} />
          {/* Where the installed app opens: straight to the signed-in role's home. */}
          <Route path="/app" element={<AppEntry />} />
          <Route path="/offline" element={<OfflinePage />} />
          <Route path="/privacy" element={<LegalPage doc="privacy" />} />
          <Route path="/terms" element={<LegalPage doc="terms" />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/checkout/mock/:orderId" element={<MockCheckoutPage />} />
          <Route path="/checkout/return" element={<CheckoutReturnPage />} />
          <Route path="/partners" element={<PartnerDirectoryPage />} />
          <Route path="/partners/:id" element={<PartnerPublicProfilePage />} />
          <Route path="/designers" element={<DesignerDirectoryPage />} />
          <Route path="/designers/:id" element={<DesignerPublicProfilePage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute role="customer">
                <CustomerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ProjectsListPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="designs" element={<DesignRequestsListPage />} />
            <Route path="designs/:id" element={<DesignRequestDetailPage />} />
          </Route>

          <Route
            path="/partner"
            element={
              <ProtectedRoute role="partner">
                <PartnerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<PartnerHomePage />} />
            <Route path="opportunities" element={<OpportunitiesPage />} />
            <Route path="opportunities/:id" element={<OpportunityDetailPage />} />
            <Route path="quotes" element={<MyQuotationsPage />} />
            <Route path="projects" element={<ActiveProjectsPage />} />
            <Route path="completed" element={<CompletedProjectsPage />} />
            <Route path="profile" element={<BusinessProfilePage />} />
            <Route path="settings" element={<PartnerSettingsPage />} />
          </Route>

          <Route
            path="/designer"
            element={
              <ProtectedRoute role="designer">
                <DesignerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DesignerHomePage />} />
            <Route path="opportunities" element={<DesignerOpportunitiesPage />} />
            <Route path="opportunities/:id" element={<DesignerOpportunityDetailPage />} />
            <Route path="orders" element={<DesignerOrdersPage />} />
            <Route path="profile" element={<DesignerProfilePage />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminUsersPage />} />
            <Route path="providers" element={<AdminProvidersPage />} />
            <Route path="designers" element={<AdminDesignersPage />} />
            <Route path="projects" element={<AdminProjectsPage />} />
            <Route path="quotes" element={<AdminQuotesPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="design-reviews" element={<AdminDesignReviewsPage />} />
          </Route>

          <Route path="*" element={<LandingPage />} />
        </Routes>
      </Suspense>
      <AuthModal />
      <UpdateToast />
      <StaleStrip />
    </>
  );
}
