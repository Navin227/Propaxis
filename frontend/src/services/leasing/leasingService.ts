import { apiFetch } from '@/src/services/api/client';
import { ApprovalRequest, EnquiryLead } from '@/src/types';

export const leasingService = {
  listEnquiries(): Promise<EnquiryLead[]> {
    return apiFetch<EnquiryLead[]>('/enquiries');
  },

  createEnquiry(payload: Partial<EnquiryLead> & { notes?: string }): Promise<EnquiryLead> {
    return apiFetch<EnquiryLead>('/enquiries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateEnquiry(id: string, payload: Partial<EnquiryLead>): Promise<EnquiryLead> {
    return apiFetch<EnquiryLead>(`/enquiries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  requestVisit(
    leadId: string,
    payload: { propertyId: string; unitNumber?: string; requestedDateTime: string }
  ): Promise<{ lead: EnquiryLead; approval: ApprovalRequest }> {
    return apiFetch<{ lead: EnquiryLead; approval: ApprovalRequest }>(`/enquiries/${leadId}/request-visit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
