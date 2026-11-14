import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { tenantService } from '@/src/services/tenants/tenantService';
import { LeaseDocument } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input, Label } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatDate } from '@/src/utils/formatters';

export function TenantDocumentsPage() {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LeaseDocument['category']>('KYC Identity');
  const [fileName, setFileName] = useState('');

  const { data: documents = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: () => tenantService.listDocuments(),
  });
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.listTenants(),
  });

  const uploadMutation = useMutation({
    mutationFn: () =>
      tenantService.uploadDocument({
        title,
        category,
        tenantId: tenants[0]?.id,
        fileName,
        fileSize: '1.2 MB',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded to your tenant vault');
      setUploadOpen(false);
      setTitle('');
      setFileName('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Failed to load lease documents." onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Lease & Documents</h1>
          <p className="text-sm text-slate-500">
            Download your registered lease agreement, inspection checklist, or upload updated KYC records.
          </p>
        </div>

        <Button variant="primary" className="min-h-[44px]" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload KYC / File
        </Button>
      </div>

      <div className="space-y-3">
        {documents.map((doc) => (
          <Card key={doc.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-blue-700 shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{doc.title}</h3>
                    {doc.leaseStatus && <StatusTag label={doc.leaseStatus} showIcon />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {doc.category} · {doc.fileName} ({doc.fileSize})
                  </p>
                  {doc.leaseStartDate && doc.leaseEndDate && (
                    <p className="mt-0.5 text-xs text-slate-600 tabular-nums">
                      Term: {formatDate(doc.leaseStartDate)} – {formatDate(doc.leaseEndDate)}
                    </p>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => toast.success(`Downloaded ${doc.fileName}`)}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Supporting Document</DialogTitle>
            <DialogDescription>
              Upload updated KYC identity, police verification, or society NOC documents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="td-title">Document Title</Label>
              <Input
                id="td-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Updated Passport KYC"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as LeaseDocument['category'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KYC Identity">KYC Identity</SelectItem>
                  <SelectItem value="Society NOC">Society NOC</SelectItem>
                  <SelectItem value="Move-in Inspection">Move-in Inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="td-file">Choose File</Label>
              <Input
                id="td-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!title.trim() || !fileName || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              Upload Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
