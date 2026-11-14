import * as Popover from '@radix-ui/react-popover';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/src/services/auth/authService';
import { formatRelativeTime } from '@/src/utils/formatters';
import { cn } from '@/src/utils/cn';

export function NotificationsPopover() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => authService.listNotifications(),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => authService.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => authService.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] font-semibold text-white tabular-nums">
              {unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[340px] sm:w-[380px] rounded-xl border border-slate-200 bg-white shadow-xl outline-none"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h4 className="font-display text-sm font-semibold text-slate-900">Notifications</h4>
              <p className="text-xs text-slate-500 tabular-nums">{unreadCount} unread updates</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">No notifications right now.</div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (!item.read) markRead.mutate(item.id);
                    if (item.actionUrl) navigate(item.actionUrl);
                  }}
                  className={cn(
                    'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer',
                    !item.read && 'bg-blue-50/40'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-medium text-blue-700">{item.category}</span>
                    <span className="tabular-nums">{formatRelativeTime(item.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600 line-clamp-2">{item.message}</p>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
