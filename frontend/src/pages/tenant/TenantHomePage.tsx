import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Building2, CalendarClock, CreditCard, MessageSquare, Wrench } from 'lucide-react';
import { tenantService } from '@/src/services/tenants/tenantService';
import { paymentService } from '@/src/services/payments/paymentService';
import { maintenanceService } from '@/src/services/maintenance/maintenanceService';
import { authService } from '@/src/services/auth/authService';
import { propertyService } from '@/src/services/properties/propertyService';
import { PaymentRecord } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { RazorpayCheckoutModal } from '@/src/components/payments/RazorpayCheckoutModal';
import { formatDate, formatINR, formatRelativeTime } from '@/src/utils/formatters';

export function TenantHomePage() {
  const [checkoutPayment, setCheckoutPayment] = useState<PaymentRecord | null>(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.listTenants(),
  });
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyService.listProperties(),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentService.listPayments(),
  });
  const { data: tickets = [] } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => maintenanceService.listTickets(),
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => authService.listNotifications(),
  });

  if (isLoading) return <LoadingState rows={5} />;

  const tenant = tenants[0];
  if (!tenant) {
    return (
      <ErrorState
        title="Resident profile not linked"
        message="Contact your Property Manager to activate your resident invitation."
      />
    );
  }

  const property = properties.find((p) => p.id === tenant.propertyId);
  const dueInvoice = payments.find((p) => p.status !== 'Paid');
  const openTickets = tickets.filter((t) => t.status !== 'Completed' && t.status !== 'Rejected');
  const daysToExpiry = Math.max(
    0,
    Math.ceil((new Date(tenant.leaseEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="space-y-6">
      {/* Welcome & Primary Property Strip */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Welcome back, {tenant.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-500">
            {tenant.propertyName} · Unit {tenant.unitNumber} · Lease {tenant.leaseId}
          </p>
        </div>

        <Button variant="primary" className="min-h-[44px]" asChild>
          <Link to="/tenant/assistant">
            <MessageSquare className="h-4 w-4" />
            Ask AI Assistant
          </Link>
        </Button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Monthly Rent Due */}
        <Card className="p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">Monthly Rent Status</span>
              <StatusTag label={dueInvoice ? dueInvoice.status : 'Paid'} showIcon />
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {dueInvoice ? formatINR(dueInvoice.amount) : formatINR(0)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {dueInvoice
                ? `${dueInvoice.billingMonth} · Due ${formatDate(dueInvoice.dueDate)}`
                : 'All rent invoices are paid and verified'}
            </p>
          </div>
          {dueInvoice ? (
            <Button
              variant="primary"
              className="w-full min-h-[44px]"
              onClick={() => setCheckoutPayment(dueInvoice)}
            >
              <CreditCard className="h-4 w-4" />
              Pay Rent Online
            </Button>
          ) : (
            <Button variant="outline" className="w-full min-h-[44px]" asChild>
              <Link to="/tenant/payments">View Payment Receipts</Link>
            </Button>
          )}
        </Card>

        {/* Lease Expiry Info */}
        <Card className="p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">Lease Agreement</span>
              <StatusTag label={daysToExpiry <= 45 ? 'Expiring Soon' : tenant.leaseStatus} />
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {daysToExpiry} days
            </p>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              Current term ends {formatDate(tenant.leaseEndDate)}
            </p>
          </div>
          <Button variant="outline" className="w-full min-h-[44px]" asChild>
            <Link to="/tenant/documents">
              <CalendarClock className="h-4 w-4" />
              View Lease & Documents
            </Link>
          </Button>
        </Card>

        {/* Open Maintenance Requests */}
        <Card className="p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">Open Maintenance</span>
              <Wrench className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {openTickets.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {openTickets[0]
                ? `Latest: ${openTickets[0].requestCode} (${openTickets[0].status})`
                : 'No active service requests'}
            </p>
          </div>
          <Button variant="outline" className="w-full min-h-[44px]" asChild>
            <Link to="/tenant/maintenance">
              <Wrench className="h-4 w-4" />
              Raise or Track Request
            </Link>
          </Button>
        </Card>
      </div>

      {/* Property Overview & Recent Notifications */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
        <Card className="lg:col-span-6 overflow-hidden flex flex-col">
          {property && (
            <div className="aspect-[16/9] w-full bg-slate-100">
              <img
                src={property.imageUrl}
                alt={property.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <CardContent className="p-5 flex-1 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Building2 className="h-3.5 w-3.5" />
                <span>Your Residence</span>
              </div>
              <h3 className="mt-1 font-display text-lg font-semibold text-slate-900">
                {tenant.propertyName} · Unit {tenant.unitNumber}
              </h3>
              <p className="text-xs text-slate-500">
                {property?.address}, {property?.city}
              </p>
            </div>
            <Link
              to="/tenant/property"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
            >
              Property specs & availability <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-6 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-500" />
              Recent Notifications
            </CardTitle>
            <Link to="/tenant/notifications" className="text-xs font-medium text-blue-700 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 flex-1">
            {notifications.slice(0, 4).map((n) => (
              <div key={n.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-medium text-blue-700">{n.category}</span>
                  <span className="tabular-nums">{formatRelativeTime(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm font-medium text-slate-900">{n.title}</p>
                <p className="text-xs text-slate-600">{n.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <RazorpayCheckoutModal
        payment={checkoutPayment}
        open={Boolean(checkoutPayment)}
        onOpenChange={(open) => !open && setCheckoutPayment(null)}
      />
    </div>
  );
}
