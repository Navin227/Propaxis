import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles, Upload, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { maintenanceService } from '@/src/services/maintenance/maintenanceService';
import { MaintenancePriority, MaintenanceTicket } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input, Label, Textarea } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatDateTime } from '@/src/utils/formatters';

export function TenantMaintenancePage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState<MaintenanceTicket['category']>('Plumbing');
  const [priority, setPriority] = useState<MaintenancePriority>('Medium');
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [aiNote, setAiNote] = useState('');

  const { data: tickets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => maintenanceService.listTickets(),
  });

  const triageMutation = useMutation({
    mutationFn: (desc: string) => maintenanceService.triageWithAI(desc),
    onSuccess: (res) => {
      setCategory(res.category);
      setPriority(res.priority);
      setAiNote(res.confidenceNote);
      toast.success(`AI suggested ${res.category} (${res.priority})`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      maintenanceService.createTicket({
        category,
        priority,
        description,
        aiSuggestedCategory: category,
        aiSuggestedPriority: priority,
        aiConfidenceNote: aiNote || undefined,
        mediaAttachments: attachmentName
          ? [
              {
                id: `med-${Date.now()}`,
                name: attachmentName,
                type: attachmentName.endsWith('.mp4') ? 'video' : 'image',
                caption: 'Uploaded by resident',
              },
            ]
          : [],
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      toast.success(`Maintenance request ${created.requestCode} submitted`);
      setModalOpen(false);
      setDescription('');
      setAttachmentName('');
      setAiNote('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Failed to load maintenance requests." onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Maintenance Requests</h1>
          <p className="text-sm text-slate-500">Raise repair issues with photos/videos and track vendor assignment.</p>
        </div>

        <Button variant="primary" className="min-h-[44px]" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Raise Request
        </Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          title="No maintenance requests yet"
          description="Submit a request whenever something in your apartment needs attention."
          actionLabel="Raise Request"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="p-4 sm:p-5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-slate-400" />
                  <span className="font-mono text-sm font-semibold text-slate-900">{t.requestCode}</span>
                  <span className="text-xs text-slate-500">· {t.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusTag label={t.priority} />
                  <StatusTag label={t.status} showIcon />
                </div>
              </div>

              <p className="text-sm text-slate-700">{t.description}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                <span>
                  Vendor: <strong className="text-slate-800">{t.assignedVendor || 'Pending manager assignment'}</strong>
                </span>
                <span className="tabular-nums">Submitted {formatDateTime(t.submittedAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise Maintenance Request</DialogTitle>
            <DialogDescription>
              Describe the issue in your unit. Your Property Manager will review and dispatch a vendor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="tm-desc">Issue Description</Label>
                <button
                  type="button"
                  disabled={!description.trim() || triageMutation.isPending}
                  onClick={() => triageMutation.mutate(description)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline disabled:opacity-40 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {triageMutation.isPending ? 'Analyzing...' : 'Auto-Classify with AI'}
                </button>
              </div>
              <Textarea
                id="tm-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Water dripping from master bathroom geyser pipe..."
              />
              {aiNote && <p className="text-xs text-blue-800 bg-blue-50 rounded-md p-2">{aiNote}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as MaintenanceTicket['category'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Plumbing">Plumbing</SelectItem>
                    <SelectItem value="Electrical">Electrical</SelectItem>
                    <SelectItem value="HVAC">HVAC</SelectItem>
                    <SelectItem value="Appliance">Appliance</SelectItem>
                    <SelectItem value="Carpentry">Carpentry</SelectItem>
                    <SelectItem value="Common Area">Common Area</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Urgency</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as MaintenancePriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tm-file">Attach Photo or Video (Optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="tm-file"
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
                />
              </div>
              {attachmentName && (
                <p className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600">
                  <Upload className="h-3 w-3" /> {attachmentName}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!description.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
