import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { tenantService } from '@/src/services/tenants/tenantService';
import { useAuth } from '@/src/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { LoadingState } from '@/src/components/ui/state-views';
import { formatDate, formatINR } from '@/src/utils/formatters';

export function TenantProfilePage() {
  const { user } = useAuth();
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.listTenants(),
  });

  if (isLoading) return <LoadingState rows={3} />;
  const tenant = tenants[0];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Resident Profile</h1>
        <p className="text-sm text-slate-500">Verified resident identity, lease summary, and emergency contact details.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{tenant?.name || user.name}</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              {tenant?.email || user.email} · {tenant?.phone || user.phone}
            </p>
          </div>
          <StatusTag label={tenant?.kycVerified ? 'KYC Verified' : 'Pending KYC'} showIcon />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs text-slate-500">Assigned Residence</p>
            <p className="font-medium text-slate-900">
              {tenant?.propertyName} · Unit {tenant?.unitNumber}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Lease Identifier</p>
            <p className="font-mono font-medium text-slate-900">{tenant?.leaseId}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Lease Duration</p>
            <p className="font-medium text-slate-900 tabular-nums">
              {tenant ? `${formatDate(tenant.leaseStartDate)} – ${formatDate(tenant.leaseEndDate)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Monthly Rent & Deposit</p>
            <p className="font-mono font-medium text-slate-900 tabular-nums">
              {tenant ? `${formatINR(tenant.monthlyRent)}/mo · ${formatINR(tenant.securityDeposit)} deposit` : '—'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-slate-500">Emergency Contact</p>
            <p className="font-medium text-slate-900">{tenant?.emergencyContact}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-700 shrink-0" />
        <p>
          Your portal displays only your unit, lease, payments, maintenance requests, and documents. Other residents'
          data is strictly isolated by backend RBAC.
        </p>
      </div>
    </div>
  );
}
