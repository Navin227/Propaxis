import { apiFetch } from '@/src/services/api/client';
import { AnalyticsSnapshot, ApprovalRequest } from '@/src/types';

export const approvalService = {
  listApprovals(): Promise<ApprovalRequest[]> {
    return apiFetch<ApprovalRequest[]>('/approvals');
  },

  decideApproval(
    id: string,
    payload: { decision: 'Approved' | 'Rejected'; decisionNote?: string }
  ): Promise<{ confirmed: boolean; approval: ApprovalRequest }> {
    return apiFetch<{ confirmed: boolean; approval: ApprovalRequest }>(`/approvals/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const analyticsService = {
  getSnapshot(): Promise<AnalyticsSnapshot> {
    return apiFetch<AnalyticsSnapshot>('/analytics');
  },
};
