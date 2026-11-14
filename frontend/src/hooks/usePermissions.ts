import { useAuth } from '@/src/contexts/AuthContext';

export function usePermissions() {
  const { user } = useAuth();
  const role = user.role;

  return {
    role,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isTenant: role === 'tenant',
    canCreateProperty: role === 'admin',
    canCreateUnit: role === 'admin',
    canManageUsers: role === 'admin',
    canAssignManagers: role === 'admin',
    canEditUnit: role === 'admin' || role === 'manager',
    canArchiveUnit: role === 'admin',
    canInviteTenant: role === 'admin' || role === 'manager',
    canManageMaintenance: role === 'admin' || role === 'manager',
    canDecideApprovals: role === 'admin' || role === 'manager',
    canUploadLeaseAgreement: role === 'admin' || role === 'manager',
    assignedPropertyIds: user.assignedPropertyIds,
  };
}
