import React from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { UserRole } from '@/src/types';
import { DashboardLayout } from '@/src/layouts/DashboardLayout';
import { TenantLayout } from '@/src/layouts/TenantLayout';
import { LoginPage } from '@/src/pages/auth/LoginPage';
import { OverviewPage } from '@/src/pages/dashboard/OverviewPage';
import { PropertiesPage } from '@/src/pages/properties/PropertiesPage';
import { PropertyDetailPage } from '@/src/pages/properties/PropertyDetailPage';
import { UnitsPage } from '@/src/pages/properties/UnitsPage';
import { TenantsPage } from '@/src/pages/tenants/TenantsPage';
import { TenantDetailPage } from '@/src/pages/tenants/TenantDetailPage';
import { LeasingPage } from '@/src/pages/leasing/LeasingPage';
import { UnifiedInboxPage } from '@/src/pages/inbox/UnifiedInboxPage';
import { MaintenancePage } from '@/src/pages/maintenance/MaintenancePage';
import { PaymentsPage } from '@/src/pages/payments/PaymentsPage';
import { DocumentsPage } from '@/src/pages/documents/DocumentsPage';
import { ApprovalsPage } from '@/src/pages/approvals/ApprovalsPage';
import { AnalyticsPage } from '@/src/pages/analytics/AnalyticsPage';
import { UserManagementPage } from '@/src/pages/admin/UserManagementPage';
import { SettingsPage } from '@/src/pages/settings/SettingsPage';
import { TenantHomePage } from '@/src/pages/tenant/TenantHomePage';
import { TenantPropertyPage } from '@/src/pages/tenant/TenantPropertyPage';
import { TenantPaymentsPage } from '@/src/pages/tenant/TenantPaymentsPage';
import { TenantMaintenancePage } from '@/src/pages/tenant/TenantMaintenancePage';
import { TenantDocumentsPage } from '@/src/pages/tenant/TenantDocumentsPage';
import { TenantAssistantPage } from '@/src/pages/tenant/TenantAssistantPage';
import { TenantNotificationsPage } from '@/src/pages/tenant/TenantNotificationsPage';
import { TenantProfilePage } from '@/src/pages/tenant/TenantProfilePage';

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'tenant' ? '/tenant/home' : '/'} replace />;
  }

  return <>{children}</>;
}

function RouterShell({ children }: { children: React.ReactNode }) {
  const isElectronFileProtocol =
    typeof window !== 'undefined' && window.location.protocol === 'file:';
  if (isElectronFileProtocol) {
    return <HashRouter>{children}</HashRouter>;
  }
  return <BrowserRouter>{children}</BrowserRouter>;
}

export function AppRouter() {
  return (
    <RouterShell>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Company Admin & Property Manager Dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="properties" element={<PropertiesPage />} />
          <Route path="properties/:id" element={<PropertyDetailPage />} />
          <Route path="units" element={<UnitsPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="tenants/:id" element={<TenantDetailPage />} />
          <Route path="leasing" element={<LeasingPage />} />
          <Route path="inbox" element={<UnifiedInboxPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route
            path="users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Tenant Portal (Mobile-First & Responsive Desktop) */}
        <Route
          path="/tenant"
          element={
            <ProtectedRoute allowedRoles={['tenant']}>
              <TenantLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/tenant/home" replace />} />
          <Route path="home" element={<TenantHomePage />} />
          <Route path="property" element={<TenantPropertyPage />} />
          <Route path="payments" element={<TenantPaymentsPage />} />
          <Route path="maintenance" element={<TenantMaintenancePage />} />
          <Route path="documents" element={<TenantDocumentsPage />} />
          <Route path="assistant" element={<TenantAssistantPage />} />
          <Route path="notifications" element={<TenantNotificationsPage />} />
          <Route path="profile" element={<TenantProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RouterShell>
  );
}
