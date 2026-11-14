import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailPlus, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { tenantService } from '@/src/services/tenants/tenantService';
import { propertyService } from '@/src/services/properties/propertyService';
import { usePermissions } from '@/src/hooks/usePermissions';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input, Label } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatDate, formatINR } from '@/src/utils/formatters';

const inviteSchema = z.object({
  name: z.string().min(2, 'Tenant full name is required'),
  email: z.string().email('Valid email address is required'),
  phone: z.string().min(8, 'Phone number is required'),
  propertyId: z.string().min(1, 'Select a property'),
  unitId: z.string().min(1, 'Select an available unit'),
  leaseStartDate: z.string().min(1, 'Lease start date required'),
  leaseEndDate: z.string().min(1, 'Lease end date required'),
  monthlyRent: z.coerce.number().min(5000),
  securityDeposit: z.coerce.number().min(0),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export function TenantsPage() {
  const { canInviteTenant } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: tenants = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.listTenants(),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyService.listProperties(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => propertyService.listUnits(),
  });

  const availableUnits = units.filter((u) => u.occupancyStatus === 'Vacant' || u.availability === 'Available');

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema) as any,
    defaultValues: {
      name: '',
      email: '',
      phone: '+91 ',
      propertyId: properties[0]?.id || 'prop-1',
      unitId: availableUnits[0]?.id || '',
      leaseStartDate: '2026-12-01',
      leaseEndDate: '2027-11-30',
      monthlyRent: 51000,
      securityDeposit: 180000,
    },
  });

  const selectedPropId = form.watch('propertyId');
  const unitsForSelectedProp = availableUnits.filter((u) => u.propertyId === selectedPropId);

  const inviteMutation = useMutation({
    mutationFn: (values: InviteFormValues) => tenantService.inviteTenant(values),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(`Portal invitation sent to ${created.email}`);
      setInviteOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch =
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.unitNumber.toLowerCase().includes(q) ||
        t.propertyName.toLowerCase().includes(q);
      const matchesPay = paymentFilter === 'all' || t.paymentStatus === paymentFilter;
      return matchesSearch && matchesPay;
    });
  }, [tenants, search, paymentFilter]);

  if (isLoading) return <LoadingState rows={5} />;
  if (isError) return <ErrorState message="Failed to load tenant directory." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Tenant Directory</h2>
          <p className="text-sm text-slate-500">
            Manage resident profiles, leases, payment standing, and portal invitations.
          </p>
        </div>

        {canInviteTenant && (
          <Button
            variant="primary"
            onClick={() => {
              const firstProp = properties[0]?.id || 'prop-1';
              const firstUnit = availableUnits.find((u) => u.propertyId === firstProp) || availableUnits[0];
              form.reset({
                name: '',
                email: '',
                phone: '+91 ',
                propertyId: firstUnit?.propertyId || firstProp,
                unitId: firstUnit?.id || '',
                leaseStartDate: '2026-12-01',
                leaseEndDate: '2027-11-30',
                monthlyRent: firstUnit?.monthlyRent || 50000,
                securityDeposit: firstUnit?.securityDeposit || 150000,
              });
              setInviteOpen(true);
            }}
          >
            <MailPlus className="h-4 w-4" />
            Invite Tenant
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant, email, unit, or property..."
            className="pl-9"
          />
        </div>

        <div className="w-44">
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payment States</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No tenants found"
          description="Try clearing search filters or invite a resident to a vacant unit."
          actionLabel={canInviteTenant ? 'Invite Tenant' : undefined}
          onAction={canInviteTenant ? () => setInviteOpen(true) : undefined}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Property & Unit</TableHead>
                <TableHead>Lease Status</TableHead>
                <TableHead className="text-right">Monthly Rent</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Profile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <p className="font-medium text-slate-900">{tenant.name}</p>
                    <p className="text-xs font-mono text-slate-500">{tenant.leaseId}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-800">{tenant.email}</p>
                    <p className="text-xs font-mono text-slate-500">{tenant.phone}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-900">{tenant.propertyName}</p>
                    <p className="text-xs text-slate-500">
                      Unit {tenant.unitNumber} · Ends {formatDate(tenant.leaseEndDate)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusTag label={tenant.leaseStatus} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-slate-900 tabular-nums">
                    {formatINR(tenant.monthlyRent)}
                  </TableCell>
                  <TableCell>
                    <StatusTag label={tenant.paymentStatus} showIcon />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/tenants/${tenant.id}`}>
                        <User className="h-3.5 w-3.5" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Invite Tenant Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Tenant to Portal</DialogTitle>
            <DialogDescription>
              Tenants cannot self-register. Send a secure onboarding invitation tied to a unit lease.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((values) => inviteMutation.mutate(values))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="t-name">Resident Full Name</Label>
                <Input id="t-name" {...form.register('name')} placeholder="e.g. Karanveer Singh" />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-email">Email</Label>
                <Input id="t-email" type="email" {...form.register('email')} placeholder="resident@domain.com" />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-phone">Mobile Number</Label>
                <Input id="t-phone" {...form.register('phone')} placeholder="+91 98450 00000" />
              </div>

              <div className="space-y-1.5">
                <Label>Property</Label>
                <Select
                  value={form.watch('propertyId')}
                  onValueChange={(v) => {
                    form.setValue('propertyId', v);
                    const nextUnit = availableUnits.find((u) => u.propertyId === v);
                    if (nextUnit) {
                      form.setValue('unitId', nextUnit.id);
                      form.setValue('monthlyRent', nextUnit.monthlyRent);
                      form.setValue('securityDeposit', nextUnit.securityDeposit);
                    } else {
                      form.setValue('unitId', '');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Available Unit</Label>
                <Select
                  value={form.watch('unitId')}
                  onValueChange={(v) => {
                    form.setValue('unitId', v);
                    const u = availableUnits.find((item) => item.id === v);
                    if (u) {
                      form.setValue('monthlyRent', u.monthlyRent);
                      form.setValue('securityDeposit', u.securityDeposit);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vacant unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitsForSelectedProp.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No vacant units in this building
                      </SelectItem>
                    ) : (
                      unitsForSelectedProp.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.unitNumber} ({u.bedrooms} BHK · {formatINR(u.monthlyRent)})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-start">Lease Start Date</Label>
                <Input id="t-start" type="date" {...form.register('leaseStartDate')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-end">Lease End Date</Label>
                <Input id="t-end" type="date" {...form.register('leaseEndDate')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-rent">Monthly Rent (INR)</Label>
                <Input id="t-rent" type="number" {...form.register('monthlyRent')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-dep">Security Deposit (INR)</Label>
                <Input id="t-dep" type="number" {...form.register('securityDeposit')} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={inviteMutation.isPending || unitsForSelectedProp.length === 0}
              >
                {inviteMutation.isPending ? 'Sending Invitation...' : 'Send Portal Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
