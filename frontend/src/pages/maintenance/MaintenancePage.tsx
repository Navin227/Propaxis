import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Plus, Search, Sparkles, Video, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { maintenanceService } from '@/src/services/maintenance/maintenanceService';
import { tenantService } from '@/src/services/tenants/tenantService';
import { useAuth } from '@/src/contexts/AuthContext';
import { MaintenancePriority, MaintenanceStatus, MaintenanceTicket } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input, Label, Textarea } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatDateTime } from '@/src/utils/formatters';

const STATUSES: MaintenanceStatus[] = [
  'New',
  'Under Review',
  'Assigned',
  'In Progress',
  'Completed',
  'Rejected',
];

const PRIORITIES: MaintenancePriority[] = ['Low', 'Medium', 'High', 'Urgent'];

const PRESET_VENDORS = [
  { name: 'Sri Balaji Plumbing Services', phone: '+91 98458 11902' },
  { name: 'CoolCraft HVAC Engineers', phone: '+91 98201 77430' },
  { name: 'VoltGrid Electrical Solutions', phone: '+91 98450 99210' },
  { name: 'Precision Woodworks BLR/Pune', phone: '+91 99802 44190' },
];

export function MaintenancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Ticket edit fields
  const [editStatus, setEditStatus] = useState<MaintenanceStatus>('Under Review');
  const [editPriority, setEditPriority] = useState<MaintenancePriority>('Medium');
  const [editVendor, setEditVendor] = useState('');
  const [editVendorPhone, setEditVendorPhone] = useState('');
  const [internalNote, setInternalNote] = useState('');

  // Create ticket fields
  const [newTenantId, setNewTenantId] = useState('');
  const [newCategory, setNewCategory] = useState<MaintenanceTicket['category']>('Plumbing');
  const [newPriority, setNewPriority] = useState<MaintenancePriority>('Medium');
  const [newDescription, setNewDescription] = useState('');
  const [aiTriageNote, setAiTriageNote] = useState('');

  const { data: tickets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => maintenanceService.listTickets(),
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.listTenants(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      maintenanceService.updateTicket(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      setSelectedTicket(updated);
      setInternalNote('');
      toast.success(`Ticket ${updated.requestCode} updated`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      maintenanceService.createTicket({
        tenantId: newTenantId || tenants[0]?.id,
        category: newCategory,
        priority: newPriority,
        description: newDescription,
        aiSuggestedCategory: newCategory,
        aiSuggestedPriority: newPriority,
        aiConfidenceNote: aiTriageNote || undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      toast.success(`Ticket ${created.requestCode} created`);
      setCreateOpen(false);
      setNewDescription('');
      setAiTriageNote('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const triageMutation = useMutation({
    mutationFn: (desc: string) => maintenanceService.triageWithAI(desc),
    onSuccess: (res) => {
      setNewCategory(res.category);
      setNewPriority(res.priority);
      setAiTriageNote(res.confidenceNote);
      toast.success(`AI Triage: ${res.category} (${res.priority})`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openManageDialog = (ticket: MaintenanceTicket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    setEditVendor(ticket.assignedVendor || '');
    setEditVendorPhone(ticket.vendorPhone || '');
    setInternalNote('');
  };

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch =
        t.requestCode.toLowerCase().includes(q) ||
        t.tenantName.toLowerCase().includes(q) ||
        t.propertyName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, search, statusFilter]);

  if (isLoading) return <LoadingState rows={5} />;
  if (isError) return <ErrorState message="Failed to load maintenance tickets." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Maintenance Operations</h2>
          <p className="text-sm text-slate-500">
            Review AI-triaged tenant tickets, assign external vendors, inspect attachments, and track resolution.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setNewTenantId(tenants[0]?.id || '');
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Log Maintenance Ticket
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, tenant, property, issue..."
            className="pl-9"
          />
        </div>

        <div className="w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((st) => (
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
          title="No maintenance tickets"
          description="No requests match your active filter criteria."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request ID</TableHead>
                <TableHead>Tenant & Unit</TableHead>
                <TableHead>Category & AI Triage</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Vendor</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-mono font-semibold text-slate-900">{ticket.requestCode}</TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-900">{ticket.tenantName}</p>
                    <p className="text-xs text-slate-500">
                      {ticket.propertyName} · Unit {ticket.unitNumber}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-900">{ticket.category}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-blue-700">
                      <Sparkles className="h-3 w-3 shrink-0" />
                      AI: {ticket.aiSuggestedCategory} · {ticket.aiSuggestedPriority}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusTag label={ticket.priority} showIcon />
                  </TableCell>
                  <TableCell>
                    <StatusTag label={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-slate-800">{ticket.assignedVendor || 'Unassigned'}</p>
                    {ticket.vendorPhone && (
                      <p className="text-xs font-mono text-slate-500">{ticket.vendorPhone}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 tabular-nums">
                    {formatDateTime(ticket.submittedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openManageDialog(ticket)}>
                      <Wrench className="h-3.5 w-3.5" />
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Review & Assign Ticket Dialog */}
      <Dialog open={Boolean(selectedTicket)} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                  <div>
                    <DialogTitle>
                      {selectedTicket.requestCode} · {selectedTicket.propertyName} ({selectedTicket.unitNumber})
                    </DialogTitle>
                    <DialogDescription>
                      Submitted by {selectedTicket.tenantName} on {formatDateTime(selectedTicket.submittedAt)}
                    </DialogDescription>
                  </div>
                  <StatusTag label={selectedTicket.status} />
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-800">
                  <p className="font-medium text-slate-900">Reported Issue</p>
                  <p className="mt-1">{selectedTicket.description}</p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-xs text-blue-950">
                  <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI Classification & Priority Suggestion</span>
                  </div>
                  <p className="mt-1">{selectedTicket.aiConfidenceNote}</p>
                </div>

                {selectedTicket.mediaAttachments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Tenant Uploaded Photos & Videos</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedTicket.mediaAttachments.map((media) => (
                        <div
                          key={media.id}
                          className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                        >
                          {media.type === 'video' ? (
                            <Video className="h-4 w-4 text-blue-700 shrink-0" />
                          ) : (
                            <Camera className="h-4 w-4 text-blue-700 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-mono font-medium text-slate-900 truncate">{media.name}</p>
                            <p className="text-slate-500 truncate">{media.caption}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Ticket Status</Label>
                    <Select value={editStatus} onValueChange={(v) => setEditStatus(v as MaintenanceStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((st) => (
                          <SelectItem key={st} value={st}>
                            {st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Priority Level</Label>
                    <Select value={editPriority} onValueChange={(v) => setEditPriority(v as MaintenancePriority)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Assign External Vendor / Technician</Label>
                    <Select
                      value={PRESET_VENDORS.some((v) => v.name === editVendor) ? editVendor : '__custom'}
                      onValueChange={(name) => {
                        const found = PRESET_VENDORS.find((v) => v.name === name);
                        if (found) {
                          setEditVendor(found.name);
                          setEditVendorPhone(found.phone);
                          if (editStatus === 'New' || editStatus === 'Under Review') {
                            setEditStatus('Assigned');
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose verified vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRESET_VENDORS.map((v) => (
                          <SelectItem key={v.name} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom">Custom Vendor Entry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="vendor-phone">Vendor Contact Number</Label>
                    <Input
                      id="vendor-phone"
                      value={editVendorPhone}
                      onChange={(e) => setEditVendorPhone(e.target.value)}
                      placeholder="+91 98..."
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mnt-note">Add Internal Manager Note</Label>
                  <Textarea
                    id="mnt-note"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Record vendor dispatch time, parts estimate, or tenant confirmation..."
                  />
                </div>

                {selectedTicket.internalNotes.length > 0 && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-600">Internal Notes History</p>
                    <div className="max-h-32 space-y-2 overflow-y-auto">
                      {selectedTicket.internalNotes.map((n) => (
                        <div key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                          <div className="flex justify-between text-slate-500">
                            <span className="font-semibold text-slate-800">{n.author}</span>
                            <span className="tabular-nums">{formatDateTime(n.createdAt)}</span>
                          </div>
                          <p className="mt-0.5 text-slate-700">{n.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      id: selectedTicket.id,
                      payload: {
                        status: editStatus,
                        priority: editPriority,
                        assignedVendor: editVendor || undefined,
                        vendorPhone: editVendorPhone || undefined,
                        internalNote: internalNote.trim() || undefined,
                        noteAuthor: user.name,
                      },
                    })
                  }
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Updates'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Maintenance Ticket Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Maintenance Request</DialogTitle>
            <DialogDescription>
              Submit a new maintenance ticket and optionally run backend AI triage for category & priority.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tenant & Unit</Label>
              <Select value={newTenantId || tenants[0]?.id || ''} onValueChange={setNewTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.propertyName} ({t.unitNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-mnt-desc">Issue Description</Label>
                <button
                  type="button"
                  disabled={!newDescription.trim() || triageMutation.isPending}
                  onClick={() => triageMutation.mutate(newDescription)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline disabled:opacity-40 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {triageMutation.isPending ? 'Running AI Triage...' : 'Suggest Category & Priority via AI'}
                </button>
              </div>
              <Textarea
                id="new-mnt-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe the repair issue in detail..."
              />
              {aiTriageNote && (
                <p className="text-xs text-blue-800 bg-blue-50 rounded-md p-2">{aiTriageNote}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={newCategory}
                  onValueChange={(v) => setNewCategory(v as MaintenanceTicket['category'])}
                >
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
                <Label>Priority</Label>
                <Select
                  value={newPriority}
                  onValueChange={(v) => setNewPriority(v as MaintenancePriority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!newDescription.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
