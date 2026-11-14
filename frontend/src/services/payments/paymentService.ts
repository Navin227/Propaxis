import { apiFetch } from '@/src/services/api/client';
import { PaymentRecord } from '@/src/types';

export interface RazorpayOrderSession {
  orderId: string;
  amountPaise: number;
  amountInr: number;
  currency: string;
  invoiceNumber: string;
  gatewayKeyHint: string;
  gatewaySessionToken: string;
}

export const paymentService = {
  listPayments(): Promise<PaymentRecord[]> {
    return apiFetch<PaymentRecord[]>('/payments');
  },

  createOrder(paymentId: string): Promise<RazorpayOrderSession> {
    return apiFetch<RazorpayOrderSession>('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ paymentId }),
    });
  },

  verifyPayment(payload: {
    orderId: string;
    gatewayPaymentId: string;
    method: PaymentRecord['method'];
    gatewaySignature: string;
    simulateFailure?: boolean;
  }): Promise<{ verified: boolean; payment: PaymentRecord }> {
    return apiFetch<{ verified: boolean; payment: PaymentRecord }>('/payments/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
