import { Routes, Route } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import DesignLandingPage from '@/pages/DesignLandingPage';
import DesignerLayout from '@/pages/designer/DesignerLayout';
import DesignerHomePage from '@/pages/designer/DesignerHomePage';
import DesignerOpportunitiesPage from '@/pages/designer/DesignerOpportunitiesPage';
import DesignerOpportunityDetailPage from '@/pages/designer/DesignerOpportunityDetailPage';
import DesignerOrdersPage from '@/pages/designer/DesignerOrdersPage';
import DesignerProfilePage from '@/pages/designer/DesignerProfilePage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import MockCheckoutPage from '@/pages/checkout/MockCheckoutPage';
import CheckoutReturnPage from '@/pages/checkout/CheckoutReturnPage';
import PartnerDirectoryPage from '@/pages/PartnerDirectoryPage';
import PartnerPublicProfilePage from '@/pages/PartnerPublicProfilePage';
import DesignerDirectoryPage from '@/pages/DesignerDirectoryPage';
import DesignerPublicProfilePage from '@/pages/DesignerPublicProfilePage';
import CustomerLayout from '@/pages/customer/CustomerLayout';
import ProjectsListPage from '@/pages/customer/ProjectsListPage';
import ProjectDetailPage from '@/pages/customer/ProjectDetailPage';
import DesignRequestsListPage from '@/pages/customer/DesignRequestsListPage';
import DesignRequestDetailPage from '@/pages/customer/DesignRequestDetailPage';
import PartnerLayout from '@/pages/partner/PartnerLayout';
import PartnerHomePage from '@/pages/partner/PartnerHomePage';
import OpportunitiesPage from '@/pages/partner/OpportunitiesPage';
import OpportunityDetailPage from '@/pages/partner/OpportunityDetailPage';
import MyQuotationsPage from '@/pages/partner/MyQuotationsPage';
import ActiveProjectsPage from '@/pages/partner/ActiveProjectsPage';
import CompletedProjectsPage from '@/pages/partner/CompletedProjectsPage';
import BusinessProfilePage from '@/pages/partner/BusinessProfilePage';
import PartnerSettingsPage from '@/pages/partner/PartnerSettingsPage';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminProvidersPage from '@/pages/admin/AdminProvidersPage';
import AdminDesignersPage from '@/pages/admin/AdminDesignersPage';
import AdminProjectsPage from '@/pages/admin/AdminProjectsPage';
import AdminQuotesPage from '@/pages/admin/AdminQuotesPage';
import AdminReviewsPage from '@/pages/admin/AdminReviewsPage';
import AdminDesignReviewsPage from '@/pages/admin/AdminDesignReviewsPage';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import AppEntry from '@/pwa/AppEntry';
import OfflinePage from '@/pwa/OfflinePage';
import { UpdateToast } from '@/pwa/UpdateToast';
import { AuthModal } from '@/components/auth/AuthModal';

/**
 * design.guma.one is the designer front door.
 *
 * Per the feature plan it is a route inside this app, not a separate build —
 * same auth, same database, same deploy. Only the root differs: on that host
 * `/` is the designer landing page instead of the customer one. Every other
 * route is shared, so a designer can be linked straight to /designer from
 * either hostname.
 */
function isDesignerHost() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('design.');
}

export default function App() {
  const designerFrontDoor = isDesignerHost();

  return (
    <>
      <Routes>
        <Route path="/" element={designerFrontDoor ? <DesignLandingPage /> : <LandingPage />} />
        {/* Reachable from the main host too, so the designer pitch can be linked. */}
        <Route path="/design" element={<DesignLandingPage />} />
        {/* Where the installed app opens: straight to the signed-in role's home. */}
        <Route path="/app" element={<AppEntry />} />
        <Route path="/offline" element={<OfflinePage />} />
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
      <AuthModal />
      <UpdateToast />
    </>
  );
}
