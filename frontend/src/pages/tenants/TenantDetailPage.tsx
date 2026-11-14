import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Mail, Phone } from 'lucide-react';
import { tenantService } from '@/src/services/tenants/tenantService';
import { paymentService } from '@/src/services/payments/paymentService';
import { maintenanceService } from '@/src/services/maintenance/maintenanceService';
import { inboxService } from '@/src/services/communication/inboxService';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { downloadVerifiedReceipt, formatDate, formatDateTime, formatINR } from '@/src/utils/formatters';
import { toast } from 'sonner';

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.listTenants(),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentService.listPayments(),
  });
  const { data: maintenance = [] } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => maintenanceService.listTickets(),
  });
  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => tenantService.listDocuments(),
  });
  const { data: threads = [] } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => inboxService.listThreads(),
  });

  if (isLoading) return <LoadingState rows={6} />;

  const tenant = tenants.find((t) => t.id === id);
  if (!tenant) {
    return (
      <ErrorState
        title="Tenant profile unavailable"
        message="This tenant record does not exist or belongs to an unassigned property."
      />
    );
  }

  const tenantPayments = payments.filter((p) => p.tenantId === tenant.id);
  const tenantTickets = maintenance.filter((m) => m.tenantId === tenant.id);
  const tenantDocs = documents.filter((d) => d.tenantId === tenant.id);
  const tenantThreads = threads.filter((th) => th.contactId === tenant.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/tenants">
            <ArrowLeft className="h-4 w-4" />
            Back to Tenants
          </Link>
        </Button>
      </div>

      {/* Header Summary Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-2xl font-semibold text-slate-900">{tenant.name}</h2>
              <StatusTag label={tenant.leaseStatus} showIcon />
              <StatusTag label={tenant.kycVerified ? 'KYC Verified' : 'KYC Pending'} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-slate-400" />
                {tenant.email}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono">
                <Phone className="h-4 w-4 text-slate-400" />
                {tenant.phone}
              </span>
            </div>
          </div>

          <div className="text-left md:text-right">
            <p className="text-xs text-slate-500">Monthly Rent</p>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {formatINR(tenant.monthlyRent)}
            </p>
            <p className="text-xs text-slate-500 tabular-nums">
              Deposit held: {formatINR(tenant.securityDeposit)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Property & Unit</p>
            <p className="font-medium text-slate-900">
              {tenant.propertyName} · Unit {tenant.unitNumber}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Lease Agreement ID</p>
            <p className="font-mono font-medium text-slate-900">{tenant.leaseId}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Lease Period</p>
            <p className="font-medium text-slate-900 tabular-nums">
              {formatDate(tenant.leaseStartDate)} – {formatDate(tenant.leaseEndDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Emergency Contact</p>
            <p className="font-medium text-slate-900">{tenant.emergencyContact}</p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="payments">
        <TabsList className="flex-wrap">
          <TabsTrigger value="payments">Payment History ({tenantPayments.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance History ({tenantTickets.length})</TabsTrigger>
          <TabsTrigger value="documents">Uploaded Documents ({tenantDocs.length})</TabsTrigger>
          <TabsTrigger value="comms">Communication History ({tenantThreads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Billing Month</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantPayments.map((pay) => (
                  <TableRow key={pay.id}>
                    <TableCell className="font-mono font-medium">{pay.invoiceNumber}</TableCell>
                    <TableCell>{pay.billingMonth}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatINR(pay.amount)}</TableCell>
                    <TableCell className="tabular-nums">{formatDate(pay.dueDate)}</TableCell>
                    <TableCell>{pay.method || '—'}</TableCell>
                    <TableCell>
                      <StatusTag label={pay.status} showIcon />
                    </TableCell>
                    <TableCell className="text-right">
                      {pay.verifiedByBackend && pay.status === 'Paid' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            downloadVerifiedReceipt(pay);
                            toast.success('Verified receipt downloaded');
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Receipt
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">Pending payment</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned Vendor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                      No maintenance requests recorded for this tenant.
                    </TableCell>
                  </TableRow>
                ) : (
                  tenantTickets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono font-medium">{t.requestCode}</TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell className="max-w-xs truncate">{t.description}</TableCell>
                      <TableCell>
                        <StatusTag label={t.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusTag label={t.status} />
                      </TableCell>
                      <TableCell>{t.assignedVendor || 'Unassigned'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="divide-y divide-slate-100 p-0">
              {tenantDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{doc.title}</p>
                    <p className="text-xs text-slate-500">
                      {doc.category} · {doc.fileName} ({doc.fileSize}) · Uploaded {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.success(`Downloading ${doc.fileName}`)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comms">
          <Card>
            <CardHeader>
              <CardTitle>Synchronized Multi-Channel Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenantThreads.length === 0 ? (
                <p className="text-sm text-slate-500">No communication threads recorded yet.</p>
              ) : (
                tenantThreads.map((thr) => (
                  <div key={thr.id} className="space-y-3">
                    <div className="rounded-lg bg-slate-50 p-3.5 text-xs text-slate-700 border border-slate-200">
                      <span className="font-semibold text-slate-900">AI Summary: </span>
                      {thr.aiSummary}
                    </div>
                    <div className="space-y-2.5">
                      {thr.messages.map((m) => (
                        <div key={m.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-medium text-slate-900">
                              {m.senderName} · {m.channel}
                            </span>
                            <span className="tabular-nums">{formatDateTime(m.timestamp)}</span>
                          </div>
                          <p className="mt-1 text-slate-700">{m.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
