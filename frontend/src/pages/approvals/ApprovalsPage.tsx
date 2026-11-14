import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { approvalService } from '@/src/services/approvals/approvalService';
import { ApprovalRequest } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Label, Textarea } from '@/src/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatDateTime } from '@/src/utils/formatters';

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [filterTab, setFilterTab] = useState<'Pending' | 'Resolved' | 'All'>('Pending');
  const [decisionTarget, setDecisionTarget] = useState<{
    approval: ApprovalRequest;
    decision: 'Approved' | 'Rejected';
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');

  const { data: approvals = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => approvalService.listApprovals(),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'Approved' | 'Rejected'; note: string }) =>
      approvalService.decideApproval(id, { decision, decisionNote: note }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(`Backend confirmed: ${res.approval.type} ${res.approval.status.toLowerCase()}`);
      setDecisionTarget(null);
      setDecisionNote('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (filterTab === 'Pending') return approvals.filter((a) => a.status === 'Pending');
    if (filterTab === 'Resolved') return approvals.filter((a) => a.status !== 'Pending');
    return approvals;
  }, [approvals, filterTab]);

  if (isLoading) return <LoadingState rows={5} />;
  if (isError) return <ErrorState message="Failed to load approvals queue." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Approval Management</h2>
          <p className="text-sm text-slate-500">
            Human-in-the-loop sign-off for property visits, lease renewals, and CapEx requests. Actions remain
            unconfirmed until backend execution succeeds.
          </p>
        </div>

        <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as typeof filterTab)}>
          <TabsList>
            <TabsTrigger value="Pending">
              Pending ({approvals.filter((a) => a.status === 'Pending').length})
            </TabsTrigger>
            <TabsTrigger value="Resolved">
              Resolved ({approvals.filter((a) => a.status !== 'Pending').length})
            </TabsTrigger>
            <TabsTrigger value="All">All ({approvals.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No approval requests in this queue"
          description="Pending visit requests and approval-gated operational items will appear here."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((apr) => (
            <Card key={apr.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-800">{apr.type}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {apr.propertyName}
                      {apr.unitNumber ? ` Unit ${apr.unitNumber}` : ''}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">Requested for {formatDateTime(apr.requestedDateTime)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-display text-base font-semibold text-slate-900">{apr.title}</h3>
                    <StatusTag
                      label={apr.status === 'Pending' ? 'Awaiting Backend Approval' : apr.status}
                      tone={apr.status === 'Approved' ? 'success' : apr.status === 'Rejected' ? 'danger' : 'warning'}
                      showIcon
                    />
                  </div>

                  <p className="text-sm text-slate-600">{apr.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span>
                      Requester: <strong className="text-slate-800">{apr.requesterName}</strong> ({apr.requesterRole})
                    </span>
                    <span>
                      Related Contact: <strong className="text-slate-800">{apr.relatedEntityName}</strong>
                    </span>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-slate-700">
                    <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>AI Context & Recommendation</span>
                    </div>
                    <p className="mt-1">{apr.aiContext}</p>
                    <p className="mt-1 font-medium text-slate-900">Recommendation: {apr.aiRecommendation}</p>
                  </div>

                  {apr.decidedBy && (
                    <p className="text-xs text-slate-500">
                      {apr.status} by {apr.decidedBy} on {formatDateTime(apr.decidedAt || '')}
                      {apr.decisionNote ? ` — "${apr.decisionNote}"` : ''}
                    </p>
                  )}
                </div>

                {apr.status === 'Pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onClick={() => setDecisionTarget({ approval: apr, decision: 'Rejected' })}
                    >
                      <X className="h-4 w-4 text-red-600" />
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => setDecisionTarget({ approval: apr, decision: 'Approved' })}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(decisionTarget)} onOpenChange={(open) => !open && setDecisionTarget(null)}>
        <DialogContent className="max-w-md">
          {decisionTarget && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Confirm {decisionTarget.decision === 'Approved' ? 'Approval' : 'Rejection'}
                </DialogTitle>
                <DialogDescription>{decisionTarget.approval.title}</DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="apr-note">Decision Note (Optional)</Label>
                <Textarea
                  id="apr-note"
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Add instructions for concierge, prospect, or team..."
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDecisionTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant={decisionTarget.decision === 'Rejected' ? 'destructive' : 'primary'}
                  disabled={decideMutation.isPending}
                  onClick={() =>
                    decideMutation.mutate({
                      id: decisionTarget.approval.id,
                      decision: decisionTarget.decision,
                      note: decisionNote,
                    })
                  }
                >
                  {decideMutation.isPending
                    ? 'Confirming with Backend...'
                    : `Confirm ${decisionTarget.decision}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
