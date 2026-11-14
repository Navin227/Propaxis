import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Download, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { paymentService } from '@/src/services/payments/paymentService';
import { PaymentRecord } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { RazorpayCheckoutModal } from '@/src/components/payments/RazorpayCheckoutModal';
import { downloadVerifiedReceipt, formatDate, formatINR } from '@/src/utils/formatters';

export function TenantPaymentsPage() {
  const [checkoutPayment, setCheckoutPayment] = useState<PaymentRecord | null>(null);
  const [verifiedNotice, setVerifiedNotice] = useState<PaymentRecord | null>(null);

  const { data: payments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentService.listPayments(),
  });

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Failed to load your rent payments." onRetry={() => refetch()} />;

  const amountDue = payments.filter((p) => p.status !== 'Paid').reduce((sum, p) => sum + p.amount, 0);
  const nextDue = payments.find((p) => p.status !== 'Paid');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Rent & Payments</h1>
        <p className="text-sm text-slate-500">
          Pay monthly rent securely via Razorpay and download server-verified payment receipts.
        </p>
      </div>

      {verifiedNotice && (
        <Card className="border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-950">
                  Payment Verified by Backend Gateway — {verifiedNotice.invoiceNumber}
                </p>
                <p className="text-xs text-emerald-800">
                  {formatINR(verifiedNotice.amount)} paid via {verifiedNotice.method} ({verifiedNotice.gatewayPaymentId})
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[40px]"
              onClick={() => downloadVerifiedReceipt(verifiedNotice)}
            >
              <Download className="h-4 w-4" />
              Download Receipt
            </Button>
          </div>
        </Card>
      )}

      {/* Amount Due Hero Card */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Amount Due</p>
            <p className="mt-1 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
              {formatINR(amountDue)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {nextDue
                ? `${nextDue.invoiceNumber} · ${nextDue.billingMonth} · Due ${formatDate(nextDue.dueDate)}`
                : 'No pending rent dues'}
            </p>
          </div>

          {nextDue && (
            <Button
              variant="primary"
              size="lg"
              className="min-h-[48px] w-full sm:w-auto"
              onClick={() => setCheckoutPayment(nextDue)}
            >
              <CreditCard className="h-4 w-4" />
              Pay Rent ({formatINR(nextDue.amount)})
            </Button>
          )}
        </div>
      </Card>

      {/* Payment History List */}
      <div className="space-y-3">
        <h2 className="font-display text-base font-semibold text-slate-900">Payment History</h2>
        <div className="space-y-3">
          {payments.map((pay) => (
            <Card key={pay.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900">{pay.invoiceNumber}</span>
                    <StatusTag label={pay.status} showIcon />
                  </div>
                  <p className="text-xs text-slate-500">
                    {pay.billingMonth} · Due {formatDate(pay.dueDate)}
                    {pay.paidDate ? ` · Paid ${formatDate(pay.paidDate)} via ${pay.method}` : ''}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                    {formatINR(pay.amount)}
                  </span>

                  {pay.status === 'Paid' && pay.verifiedByBackend ? (
                    <Button
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => {
                        downloadVerifiedReceipt(pay);
                        toast.success(`Receipt downloaded for ${pay.invoiceNumber}`);
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Receipt
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      className="min-h-[44px]"
                      onClick={() => setCheckoutPayment(pay)}
                    >
                      Pay Rent
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <RazorpayCheckoutModal
        payment={checkoutPayment}
        open={Boolean(checkoutPayment)}
        onOpenChange={(open) => !open && setCheckoutPayment(null)}
        onVerified={(verified) => setVerifiedNotice(verified)}
      />
    </div>
  );
}
