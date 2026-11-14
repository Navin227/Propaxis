import { apiFetch } from '@/src/services/api/client';
import { AIOrchestratorResponse, ChannelType, InboxThread } from '@/src/types';

export const inboxService = {
  listThreads(): Promise<InboxThread[]> {
    return apiFetch<InboxThread[]>('/inbox');
  },

  sendMessage(
    threadId: string,
    payload: {
      senderType: 'user' | 'ai' | 'manager';
      senderName: string;
      channel: ChannelType;
      content: string;
      requestHumanAssistance?: boolean;
      humanReason?: string;
    }
  ): Promise<InboxThread> {
    return apiFetch<InboxThread>(`/inbox/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  invokeAssistant(payload: {
    message: string;
    channel?: 'Portal' | ChannelType;
    threadId?: string;
    history?: { sender: string; text: string }[];
  }): Promise<AIOrchestratorResponse> {
    return apiFetch<AIOrchestratorResponse>('/ai/assistant', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
