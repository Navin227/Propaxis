import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, Lock, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { paymentService, RazorpayOrderSession } from '@/src/services/payments/paymentService';
import { PaymentRecord } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/input';
import { formatINR } from '@/src/utils/formatters';

export function RazorpayCheckoutModal({
  payment,
  open,
  onOpenChange,
  onVerified,
}: {
  payment: PaymentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified?: (verifiedPayment: PaymentRecord) => void;
}) {
  const queryClient = useQueryClient();
  const [orderSession, setOrderSession] = useState<RazorpayOrderSession | null>(null);
  const [method, setMethod] = useState<PaymentRecord['method']>('Razorpay UPI');
  const [gatewayError, setGatewayError] = useState<string>('');

  const createOrderMutation = useMutation({
    mutationFn: (paymentId: string) => paymentService.createOrder(paymentId),
    onSuccess: (session) => {
      setOrderSession(session);
      setGatewayError('');
    },
    onError: (err: Error) => {
      setGatewayError(err.message);
      toast.error(err.message);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (opts: { simulateFailure?: boolean }) => {
      if (!orderSession) throw new Error('Missing backend order session');
      return paymentService.verifyPayment({
        orderId: orderSession.orderId,
        gatewayPaymentId: `pay_Rzp${Date.now().toString().slice(-8)}`,
        method,
        gatewaySignature: orderSession.gatewaySessionToken,
        simulateFailure: opts.simulateFailure,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(`Backend verified payment for ${res.payment.invoiceNumber}`);
      onVerified?.(res.payment);
      setOrderSession(null);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setGatewayError(err.message);
      toast.error(err.message);
    },
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setOrderSession(null);
      setGatewayError('');
    }
    onOpenChange(nextOpen);
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Razorpay Verified Rent Checkout</DialogTitle>
          <DialogDescription>
            Invoice {payment.invoiceNumber} · {payment.propertyName} Unit {payment.unitNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">{payment.billingMonth} Rent</p>
              <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {formatINR(payment.amount)}
              </p>
            </div>
            <CreditCard className="h-6 w-6 text-blue-700" />
          </div>

          {gatewayError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{gatewayError}</span>
            </div>
          )}

          {!orderSession ? (
            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Payment success is never recorded on the client. First initialize a signed Razorpay gateway order on
                the backend server.
              </p>
              <Button
                variant="primary"
                className="w-full"
                disabled={createOrderMutation.isPending}
                onClick={() => createOrderMutation.mutate(payment.id)}
              >
                <Lock className="h-4 w-4" />
                {createOrderMutation.isPending ? 'Creating Server Order...' : 'Initialize Razorpay Order'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 p-3 text-xs space-y-1">
                <p className="text-slate-500">Backend Order ID</p>
                <p className="font-mono font-medium text-slate-900">{orderSession.orderId}</p>
              </div>

              <div className="space-y-2">
                <Label>Select Payment Instrument</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Razorpay UPI', 'Razorpay Card', 'Razorpay NetBanking'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                        method === m
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {m.replace('Razorpay ', '')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  variant="primary"
                  disabled={verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate({ simulateFailure: false })}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {verifyMutation.isPending ? 'Verifying Signature...' : `Authorize & Verify ${formatINR(payment.amount)}`}
                </Button>
                <Button
                  variant="outline"
                  disabled={verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate({ simulateFailure: true })}
                >
                  Simulate Bank Decline (Verify Error Handling)
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
            Cancel Checkout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
