import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { authService } from '@/src/services/auth/authService';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatRelativeTime } from '@/src/utils/formatters';
import { cn } from '@/src/utils/cn';

export function TenantNotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, isError, refetch } = useQuery({
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

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Failed to load notifications." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            Rent reminders, verified payment confirmations, maintenance updates, and lease expiry alerts.
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <Button variant="outline" className="min-h-[44px]" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="h-4 w-4" />
            Mark All Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState title="All caught up" description="You have no unread alerts or notifications." />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card
              key={n.id}
              onClick={() => !n.read && markRead.mutate(n.id)}
              className={cn(
                'p-4 transition-colors cursor-pointer',
                !n.read ? 'border-blue-200 bg-blue-50/40' : 'bg-white'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Bell className={cn('mt-0.5 h-4 w-4 shrink-0', !n.read ? 'text-blue-700' : 'text-slate-400')} />
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-blue-700">{n.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatRelativeTime(n.createdAt)}</span>
                    </div>
                    <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{n.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                  </div>
                </div>
                {!n.read && <span className="text-[11px] font-medium text-blue-700 shrink-0">Unread</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
