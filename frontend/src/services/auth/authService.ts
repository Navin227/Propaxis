import { apiFetch } from '@/src/services/api/client';
import { AppNotification, UserAccount, UserRole } from '@/src/types';

export const authService = {
  listUsers(): Promise<UserAccount[]> {
    return apiFetch<UserAccount[]>('/users');
  },

  createUser(payload: {
    name: string;
    email: string;
    phone: string;
    userRole: UserRole;
    designation: string;
    assignedPropertyIds: string[];
  }): Promise<UserAccount> {
    return apiFetch<UserAccount>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateUser(id: string, payload: Partial<UserAccount>): Promise<UserAccount> {
    return apiFetch<UserAccount>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  listNotifications(): Promise<AppNotification[]> {
    return apiFetch<AppNotification[]>('/notifications');
  },

  markNotificationRead(id: string): Promise<AppNotification> {
    return apiFetch<AppNotification>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  markAllNotificationsRead(): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('/notifications/mark-all-read', {
      method: 'POST',
    });
  },
};
