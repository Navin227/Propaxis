import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Download, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { paymentService } from '@/src/services/payments/paymentService';
import { PaymentRecord } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { RazorpayCheckoutModal } from '@/src/components/payments/RazorpayCheckoutModal';
import { downloadVerifiedReceipt, formatDate, formatINR } from '@/src/utils/formatters';

export function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [checkoutTarget, setCheckoutTarget] = useState<PaymentRecord | null>(null);

  const { data: payments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentService.listPayments(),
  });

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.tenantName.toLowerCase().includes(q) ||
        p.propertyName.toLowerCase().includes(q) ||
        p.unitNumber.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payments, search, statusFilter]);

  const totalCollected = payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === 'Pending' || p.status === 'Verification Pending').reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter((p) => p.status === 'Overdue').reduce((s, p) => s + p.amount, 0);

  if (isLoading) return <LoadingState rows={6} />;
  if (isError) return <ErrorState message="Failed to load rent ledger." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">Rent & Payment Ledger</h2>
        <p className="text-sm text-slate-500">
          Track collected, pending, and overdue rent across Razorpay gateway transactions with server-verified receipts.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Total Rent Collected (Verified)</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {formatINR(totalCollected)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Pending Rent</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {formatINR(totalPending)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Overdue Rent</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-red-700 tabular-nums">
            {formatINR(totalOverdue)}
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
            placeholder="Search invoice, tenant, or unit..."
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
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No payment records" description="Adjust filters to view rent transactions." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Tenant & Unit</TableHead>
                <TableHead>Billing Month</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Due / Paid Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((pay) => (
                <TableRow key={pay.id}>
                  <TableCell>
                    <p className="font-mono font-semibold text-slate-900">{pay.invoiceNumber}</p>
                    {pay.verifiedByBackend && (
                      <p className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                        <ShieldCheck className="h-3 w-3" />
                        Server Verified
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-900">{pay.tenantName}</p>
                    <p className="text-xs text-slate-500">
                      {pay.propertyName} · Unit {pay.unitNumber}
                    </p>
                  </TableCell>
                  <TableCell>{pay.billingMonth}</TableCell>
                  <TableCell className="text-right font-mono font-medium text-slate-900 tabular-nums">
                    {formatINR(pay.amount)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    <p>Due: {formatDate(pay.dueDate)}</p>
                    {pay.paidDate && <p className="text-emerald-700">Paid: {formatDate(pay.paidDate)}</p>}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{pay.method || '—'}</TableCell>
                  <TableCell>
                    <StatusTag label={pay.status} showIcon />
                  </TableCell>
                  <TableCell className="text-right">
                    {pay.status === 'Paid' && pay.verifiedByBackend ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          downloadVerifiedReceipt(pay);
                          toast.success(`Receipt downloaded for ${pay.invoiceNumber}`);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Receipt
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => setCheckoutTarget(pay)}>
                        <CreditCard className="h-3.5 w-3.5" />
                        Collect via Gateway
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <RazorpayCheckoutModal
        payment={checkoutTarget}
        open={Boolean(checkoutTarget)}
        onOpenChange={(open) => !open && setCheckoutTarget(null)}
      />
    </div>
  );
}
