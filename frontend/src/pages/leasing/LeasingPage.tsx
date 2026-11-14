import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarClock,
  Globe,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { leasingService } from '@/src/services/leasing/leasingService';
import { propertyService } from '@/src/services/properties/propertyService';
import { inboxService } from '@/src/services/communication/inboxService';
import { EnquiryLead, EnquirySource, LeadStatus } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input, Label, Textarea } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatDateTime, formatINR } from '@/src/utils/formatters';

const LEAD_STATUSES: LeadStatus[] = [
  'New Enquiry',
  'AI Engaged',
  'Property Suggested',
  'Visit Requested',
  'Visit Approved',
  'Visit Rejected',
  'Visit Completed',
  'Booking in Progress',
  'Converted',
  'Lost',
];

const SOURCE_ICONS: Record<EnquirySource, React.ComponentType<{ className?: string }>> = {
  Website: Globe,
  Voice: Phone,
  SMS: MessageSquare,
  Email: Mail,
};

const enquirySchema = z.object({
  name: z.string().min(2, 'Prospect name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(8, 'Phone number required'),
  budgetMin: z.coerce.number().min(10000),
  budgetMax: z.coerce.number().min(15000),
  preferredLocation: z.string().min(2),
  preferredConfig: z.string().min(2),
  source: z.enum(['Website', 'Voice', 'SMS', 'Email']),
  assignedPropertyId: z.string().min(1),
  notes: z.string().optional(),
});

type EnquiryFormValues = z.infer<typeof enquirySchema>;

export function LeasingPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState<EnquiryLead | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [visitDateInput, setVisitDateInput] = useState('2026-11-16T11:00');
  const [followUpText, setFollowUpText] = useState('');

  const { data: enquiries = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['enquiries'],
    queryFn: () => leasingService.listEnquiries(),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyService.listProperties(),
  });

  const { data: threads = [] } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => inboxService.listThreads(),
  });

  const form = useForm<EnquiryFormValues>({
    resolver: zodResolver(enquirySchema) as any,
    defaultValues: {
      name: '',
      email: '',
      phone: '+91 ',
      budgetMin: 45000,
      budgetMax: 65000,
      preferredLocation: 'Indiranagar, Bengaluru',
      preferredConfig: '2 BHK',
      source: 'Website',
      assignedPropertyId: properties[0]?.id || 'prop-1',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: EnquiryFormValues) => leasingService.createEnquiry(values),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      toast.success(`Enquiry logged for ${created.name}`);
      setCreateOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EnquiryLead> }) =>
      leasingService.updateEnquiry(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      setSelectedLead(updated);
      toast.success('Lead updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const requestVisitMutation = useMutation({
    mutationFn: ({ leadId, propertyId, requestedDateTime }: { leadId: string; propertyId: string; requestedDateTime: string }) =>
      leasingService.requestVisit(leadId, { propertyId, requestedDateTime }),
    onSuccess: ({ lead }) => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setSelectedLead(lead);
      toast.success('Visit request sent to Approvals queue. It remains pending until manager sign-off.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    return enquiries.filter((e) => {
      const q = search.toLowerCase();
      const matchesSearch =
        e.name.toLowerCase().includes(q) ||
        e.preferredLocation.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q);
      const matchesSource = sourceFilter === 'all' || e.source === sourceFilter;
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      return matchesSearch && matchesSource && matchesStatus;
    });
  }, [enquiries, search, sourceFilter, statusFilter]);

  const activeLeadThread = selectedLead
    ? threads.find((t) => t.contactId === selectedLead.id)
    : undefined;

  if (isLoading) return <LoadingState rows={6} />;
  if (isError) return <ErrorState message="Could not load leasing enquiries." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Leasing & Enquiries</h2>
          <p className="text-sm text-slate-500">
            Consolidated lead pipeline across Website, Voice, SMS, and Email with AI matching and approval-gated visits.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            form.reset({
              name: '',
              email: '',
              phone: '+91 ',
              budgetMin: 45000,
              budgetMax: 65000,
              preferredLocation: 'Indiranagar, Bengaluru',
              preferredConfig: '2 BHK',
              source: 'Website',
              assignedPropertyId: properties[0]?.id || 'prop-1',
              notes: '',
            });
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Log Enquiry
        </Button>
      </div>

      {/* Pipeline Summary Strip */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total Consolidated Leads</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">{enquiries.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">AI Engaged / Matched</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
            {enquiries.filter((e) => e.status === 'AI Engaged' || e.status === 'Property Suggested').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Visits Pending Approval</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {enquiries.filter((e) => e.status === 'Visit Requested').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Approved / Booking</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {enquiries.filter((e) => ['Visit Approved', 'Booking in Progress', 'Converted'].includes(e.status)).length}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lead, location, or email..."
            className="pl-9"
          />
        </div>

        <div className="w-40">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="Website">Website</SelectItem>
              <SelectItem value="Voice">Voice</SelectItem>
              <SelectItem value="SMS">SMS</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Lead Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pipeline Stages</SelectItem>
              {LEAD_STATUSES.map((st) => (
                <SelectItem key={st} value={st}>
                  {st}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No leads match your filters"
          description="Clear search or log a new prospect enquiry."
          actionLabel="Log Enquiry"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Requirements</TableHead>
                <TableHead className="text-right">Budget (INR)</TableHead>
                <TableHead>Matched Property</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Inspect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => {
                const SourceIcon = SOURCE_ICONS[lead.source];
                const prop = properties.find((p) => p.id === lead.assignedPropertyId);
                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <p className="font-medium text-slate-900">{lead.name}</p>
                      <p className="text-xs text-slate-500">{lead.phone}</p>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <SourceIcon className="h-3.5 w-3.5 text-slate-400" />
                        {lead.source}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-900">{lead.preferredConfig}</p>
                      <p className="text-xs text-slate-500">{lead.preferredLocation}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatINR(lead.budgetMin)} – {formatINR(lead.budgetMax)}
                    </TableCell>
                    <TableCell>{prop?.name || 'Pending Match'}</TableCell>
                    <TableCell>
                      <StatusTag label={lead.status} showIcon />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedLead(lead)}>
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Lead Details & Property Matching Dialog */}
      <Dialog open={Boolean(selectedLead)} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-2xl">
          {selectedLead && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                  <div>
                    <DialogTitle>{selectedLead.name}</DialogTitle>
                    <DialogDescription>
                      {selectedLead.email} · {selectedLead.phone} · Source: {selectedLead.source}
                    </DialogDescription>
                  </div>
                  <StatusTag label={selectedLead.status} showIcon />
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* AI Summary */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI Leasing Summary & Qualification</span>
                  </div>
                  <p className="mt-1 text-slate-700">{selectedLead.aiSummary}</p>
                </div>

                {/* Matching & Stage Controls */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Matched Property</Label>
                    <Select
                      value={selectedLead.assignedPropertyId || ''}
                      onValueChange={(propId) =>
                        updateLeadMutation.mutate({
                          id: selectedLead.id,
                          payload: {
                            assignedPropertyId: propId,
                            matchedPropertyIds: Array.from(new Set([...selectedLead.matchedPropertyIds, propId])),
                            status:
                              selectedLead.status === 'New Enquiry' || selectedLead.status === 'AI Engaged'
                                ? 'Property Suggested'
                                : selectedLead.status,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Match a property" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.vacantUnits} vacant)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Pipeline Stage</Label>
                    <Select
                      value={selectedLead.status}
                      onValueChange={(st) =>
                        updateLeadMutation.mutate({
                          id: selectedLead.id,
                          payload: { status: st as LeadStatus },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUSES.map((st) => (
                          <SelectItem key={st} value={st} disabled={st === 'Visit Approved'}>
                            {st === 'Visit Approved' ? 'Visit Approved (Use Approvals Queue)' : st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Visit Request (Requires Manager Approval) */}
                <Card className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1.5 flex-1">
                      <Label htmlFor="visit-dt">Request Property Visit Slot (Approval Required)</Label>
                      <Input
                        id="visit-dt"
                        type="datetime-local"
                        value={visitDateInput}
                        onChange={(e) => setVisitDateInput(e.target.value)}
                      />
                      <p className="text-[11px] text-slate-500">
                        Submitting creates a pending approval item. Visits are never confirmed until approved.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={requestVisitMutation.isPending}
                      onClick={() =>
                        requestVisitMutation.mutate({
                          leadId: selectedLead.id,
                          propertyId: selectedLead.assignedPropertyId || properties[0]?.id || 'prop-1',
                          requestedDateTime: visitDateInput,
                        })
                      }
                    >
                      <CalendarClock className="h-4 w-4" />
                      Submit Visit Request
                    </Button>
                  </div>
                </Card>

                {/* Conversation & Follow-Up History */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-700">Follow-Up Log</h4>
                    <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                      {selectedLead.followUps.length === 0 ? (
                        <p className="text-xs text-slate-400">No follow-ups logged yet.</p>
                      ) : (
                        selectedLead.followUps.map((f) => (
                          <div key={f.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0 text-xs">
                            <p className="font-medium text-slate-900">{f.by}</p>
                            <p className="text-slate-600">{f.note}</p>
                            <p className="text-[11px] text-slate-400 tabular-nums">{formatDateTime(f.date)}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={followUpText}
                        onChange={(e) => setFollowUpText(e.target.value)}
                        placeholder="Add follow-up note..."
                        className="h-9 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!followUpText.trim()) return;
                          updateLeadMutation.mutate({
                            id: selectedLead.id,
                            payload: {
                              followUps: [
                                {
                                  id: `fu-${Date.now()}`,
                                  date: new Date().toISOString(),
                                  note: followUpText.trim(),
                                  by: 'Leasing Team',
                                },
                                ...selectedLead.followUps,
                              ],
                            },
                          });
                          setFollowUpText('');
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-700">Synced Conversation History</h4>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                      {!activeLeadThread ? (
                        <p className="text-xs text-slate-400">No unified inbox messages synced yet.</p>
                      ) : (
                        activeLeadThread.messages.map((m) => (
                          <div key={m.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0 text-xs">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="font-medium text-slate-900">
                                {m.senderName} ({m.channel})
                              </span>
                              <span>{formatDateTime(m.timestamp)}</span>
                            </div>
                            <p className="mt-0.5 text-slate-700">{m.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Log New Enquiry Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Leasing Enquiry</DialogTitle>
            <DialogDescription>Capture a prospect enquiry from Website, Voice, SMS, or Email.</DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="l-name">Prospect Name</Label>
                <Input id="l-name" {...form.register('name')} placeholder="e.g. Rohan Deshpande" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-email">Email</Label>
                <Input id="l-email" type="email" {...form.register('email')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-phone">Phone</Label>
                <Input id="l-phone" {...form.register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label>Source Channel</Label>
                <Select
                  value={form.watch('source')}
                  onValueChange={(v) => form.setValue('source', v as EnquirySource)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Website">Website</SelectItem>
                    <SelectItem value="Voice">Voice</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target Property</Label>
                <Select
                  value={form.watch('assignedPropertyId')}
                  onValueChange={(v) => form.setValue('assignedPropertyId', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-loc">Preferred Location</Label>
                <Input id="l-loc" {...form.register('preferredLocation')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-cfg">Preferred Configuration</Label>
                <Input id="l-cfg" {...form.register('preferredConfig')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-bmin">Min Budget (INR)</Label>
                <Input id="l-bmin" type="number" {...form.register('budgetMin')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-bmax">Max Budget (INR)</Label>
                <Input id="l-bmax" type="number" {...form.register('budgetMax')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="l-notes">Initial Notes</Label>
                <Textarea id="l-notes" {...form.register('notes')} placeholder="Move-in timeline or unit preferences..." />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={createMutation.isPending}>
                Create Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
