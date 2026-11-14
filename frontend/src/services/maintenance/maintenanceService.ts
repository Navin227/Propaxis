import { apiFetch } from '@/src/services/api/client';
import { MaintenancePriority, MaintenanceTicket } from '@/src/types';

export const maintenanceService = {
  listTickets(): Promise<MaintenanceTicket[]> {
    return apiFetch<MaintenanceTicket[]>('/maintenance');
  },

  createTicket(payload: {
    tenantId?: string;
    category: MaintenanceTicket['category'];
    description: string;
    priority: MaintenancePriority;
    aiSuggestedCategory?: string;
    aiSuggestedPriority?: MaintenancePriority;
    aiConfidenceNote?: string;
    mediaAttachments?: { id: string; name: string; type: 'image' | 'video'; caption: string }[];
  }): Promise<MaintenanceTicket> {
    return apiFetch<MaintenanceTicket>('/maintenance', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTicket(
    id: string,
    payload: Partial<MaintenanceTicket> & { internalNote?: string; noteAuthor?: string }
  ): Promise<MaintenanceTicket> {
    return apiFetch<MaintenanceTicket>(`/maintenance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  triageWithAI(description: string): Promise<{
    category: MaintenanceTicket['category'];
    priority: MaintenancePriority;
    confidenceNote: string;
  }> {
    return apiFetch('/ai/triage-maintenance', {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  },
};
