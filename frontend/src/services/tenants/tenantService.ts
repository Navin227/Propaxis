import { apiFetch } from '@/src/services/api/client';
import { LeaseDocument, Tenant } from '@/src/types';

export const tenantService = {
  listTenants(): Promise<Tenant[]> {
    return apiFetch<Tenant[]>('/tenants');
  },

  inviteTenant(payload: {
    name: string;
    email: string;
    phone: string;
    propertyId: string;
    unitId: string;
    leaseStartDate: string;
    leaseEndDate: string;
    monthlyRent: number;
    securityDeposit: number;
  }): Promise<Tenant> {
    return apiFetch<Tenant>('/tenants/invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listDocuments(): Promise<LeaseDocument[]> {
    return apiFetch<LeaseDocument[]>('/documents');
  },

  uploadDocument(payload: Partial<LeaseDocument>): Promise<LeaseDocument> {
    return apiFetch<LeaseDocument>('/documents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
