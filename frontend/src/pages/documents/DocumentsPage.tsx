import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, Download, FileText, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { tenantService } from '@/src/services/tenants/tenantService';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input, Label } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatDate } from '@/src/utils/formatters';

const docSchema = z.object({
  title: z.string().min(3, 'Document title is required'),
  category: z.enum(['Lease Agreement', 'KYC Identity', 'Move-in Inspection', 'Rent Receipt', 'Society NOC']),
  tenantId: z.string().min(1, 'Select a tenant'),
  leaseStartDate: z.string().optional(),
  leaseEndDate: z.string().optional(),
  fileName: z.string().min(3, 'Select a file to upload'),
});

type DocFormValues = z.infer<typeof docSchema>;

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: documents = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: () => tenantService.listDocuments(),
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.listTenants(),
  });

  const form = useForm<DocFormValues>({
    resolver: zodResolver(docSchema),
    defaultValues: {
      title: '',
      category: 'Lease Agreement',
      tenantId: tenants[0]?.id || 'ten-1',
      leaseStartDate: '2026-12-01',
      leaseEndDate: '2027-11-30',
      fileName: '',
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (values: DocFormValues) =>
      tenantService.uploadDocument({
        ...values,
        fileSize: '1.8 MB',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded and indexed');
      setUploadOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const expiringLeases = useMemo(
    () => documents.filter((d) => d.category === 'Lease Agreement' && d.leaseStatus === 'Expiring Soon'),
    [documents]
  );

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const q = search.toLowerCase();
      const matchesSearch =
        d.title.toLowerCase().includes(q) ||
        d.tenantName.toLowerCase().includes(q) ||
        d.propertyName.toLowerCase().includes(q) ||
        d.unitNumber.toLowerCase().includes(q);
      const matchesCat = categoryFilter === 'all' || d.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [documents, search, categoryFilter]);

  const handleSimulatedDownload = (fileName: string, title: string) => {
    const content = `PropAxis Document Archive\nTitle: ${title}\nFile: ${fileName}\nDownloaded: ${new Date().toISOString()}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${fileName}`);
  };

  if (isLoading) return <LoadingState rows={5} />;
  if (isError) return <ErrorState message="Failed to load lease documents." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Lease & Document Management</h2>
          <p className="text-sm text-slate-500">
            Upload signed lease agreements, resident KYC packs, and inspection checklists.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            form.reset({
              title: '',
              category: 'Lease Agreement',
              tenantId: tenants[0]?.id || 'ten-1',
              leaseStartDate: '2026-12-01',
              leaseEndDate: '2027-11-30',
              fileName: '',
            });
            setUploadOpen(true);
          }}
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Expiry Reminders Banner */}
      {expiringLeases.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 text-amber-700 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Lease Expiry Reminders ({expiringLeases.length} agreements maturing within 45 days)
              </h3>
              <p className="mt-1 text-xs text-amber-800">
                {expiringLeases
                  .map((l) => `${l.tenantName} (${l.propertyName} ${l.unitNumber}, ends ${formatDate(l.leaseEndDate || '')})`)
                  .join(' · ')}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lease, tenant, unit..."
            className="pl-9"
          />
        </div>

        <div className="w-48">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Lease Agreement">Lease Agreement</SelectItem>
              <SelectItem value="KYC Identity">KYC Identity</SelectItem>
              <SelectItem value="Move-in Inspection">Move-in Inspection</SelectItem>
              <SelectItem value="Rent Receipt">Rent Receipt</SelectItem>
              <SelectItem value="Society NOC">Society NOC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No documents found"
          description="Upload signed lease agreements or KYC documents to store them in the vault."
          actionLabel="Upload Document"
          onAction={() => setUploadOpen(true)}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tenant & Unit</TableHead>
                <TableHead>Lease Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="font-medium text-slate-900">{doc.title}</p>
                        <p className="text-xs font-mono text-slate-500">
                          {doc.fileName} · {doc.fileSize}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{doc.category}</TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-900">{doc.tenantName}</p>
                    <p className="text-xs text-slate-500">
                      {doc.propertyName} · Unit {doc.unitNumber}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {doc.leaseStartDate && doc.leaseEndDate
                      ? `${formatDate(doc.leaseStartDate)} – ${formatDate(doc.leaseEndDate)}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {doc.leaseStatus ? <StatusTag label={doc.leaseStatus} showIcon /> : <span className="text-xs text-slate-400">Stored</span>}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    <p>{doc.uploadedBy}</p>
                    <p className="tabular-nums">{formatDate(doc.uploadedAt)}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSimulatedDownload(doc.fileName, doc.title)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Upload Document Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Lease or Tenant Document</DialogTitle>
            <DialogDescription>
              Attach an existing executed PDF lease agreement or tenant compliance file.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit((v) => uploadMutation.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-title">Document Title</Label>
              <Input id="doc-title" {...form.register('title')} placeholder="e.g. Executed Lease Agreement — B-204" />
              {form.formState.errors.title && (
                <p className="text-xs text-red-600">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.watch('category')}
                  onValueChange={(v) => form.setValue('category', v as DocFormValues['category'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lease Agreement">Lease Agreement</SelectItem>
                    <SelectItem value="KYC Identity">KYC Identity</SelectItem>
                    <SelectItem value="Move-in Inspection">Move-in Inspection</SelectItem>
                    <SelectItem value="Rent Receipt">Rent Receipt</SelectItem>
                    <SelectItem value="Society NOC">Society NOC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Resident / Tenant</Label>
                <Select
                  value={form.watch('tenantId')}
                  onValueChange={(v) => form.setValue('tenantId', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.unitNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.watch('category') === 'Lease Agreement' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-start">Lease Start Date</Label>
                  <Input id="doc-start" type="date" {...form.register('leaseStartDate')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-end">Lease End Date</Label>
                  <Input id="doc-end" type="date" {...form.register('leaseEndDate')} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="doc-file">Select File (PDF / Image)</Label>
              <Input
                id="doc-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) form.setValue('fileName', file.name, { shouldValidate: true });
                }}
              />
              {form.watch('fileName') && (
                <p className="text-xs font-mono text-slate-600">Selected: {form.watch('fileName')}</p>
              )}
              {form.formState.errors.fileName && (
                <p className="text-xs text-red-600">{form.formState.errors.fileName.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? 'Uploading...' : 'Upload to Vault'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
