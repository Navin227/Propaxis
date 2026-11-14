import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarClock, MapPin, User } from 'lucide-react';
import { toast } from 'sonner';
import { tenantService } from '@/src/services/tenants/tenantService';
import { propertyService } from '@/src/services/properties/propertyService';
import { leasingService } from '@/src/services/leasing/leasingService';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input, Label, Textarea } from '@/src/components/ui/input';
import { LoadingState } from '@/src/components/ui/state-views';
import { formatDate, formatINR } from '@/src/utils/formatters';

export function TenantPropertyPage() {
  const queryClient = useQueryClient();
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [visitDate, setVisitDate] = useState('2026-11-18T11:00');
  const [notes, setNotes] = useState('');

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.listTenants(),
  });
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => propertyService.listUnits(),
  });
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyService.listProperties(),
  });

  const submitVisitEnquiry = useMutation({
    mutationFn: () => {
      const tenant = tenants[0];
      return leasingService.createEnquiry({
        name: tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        preferredLocation: properties[0]?.city || 'Bengaluru',
        preferredConfig: '2 BHK / 3 BHK Upgrade',
        source: 'Website',
        assignedPropertyId: tenant.propertyId,
        visitRequestedDate: visitDate,
        notes: notes || 'Existing tenant requesting upgrade/transfer walkthrough.',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Visit request submitted. Pending Property Manager approval.');
      setEnquiryOpen(false);
      setNotes('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <LoadingState rows={4} />;

  const tenant = tenants[0];
  const unit = units.find((u) => u.id === tenant?.unitId);
  const property = properties.find((p) => p.id === tenant?.propertyId);

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">My Property & Unit</h1>
          <p className="text-sm text-slate-500">Apartment specifications, building amenities, and manager contact.</p>
        </div>
        <Button variant="outline" className="min-h-[44px]" onClick={() => setEnquiryOpen(true)}>
          <CalendarClock className="h-4 w-4" />
          Request Unit Upgrade / Visit
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {property && (
            <div className="lg:col-span-5 min-h-[220px] bg-slate-100">
              <img
                src={property.imageUrl}
                alt={property.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="lg:col-span-7 p-6 space-y-5">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900">
                {tenant.propertyName} · Unit {tenant.unitNumber}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>
                  {property?.address}, {property?.city}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-slate-100 pt-4">
              <div>
                <p className="text-xs text-slate-500">Configuration</p>
                <p className="font-semibold text-slate-900">{unit?.bedrooms || 2} BHK · {unit?.bathrooms || 2} Bath</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Carpet Area</p>
                <p className="font-mono font-semibold text-slate-900 tabular-nums">{unit?.areaSqFt || 1320} sq.ft</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Monthly Rent</p>
                <p className="font-mono font-semibold text-slate-900 tabular-nums">{formatINR(tenant.monthlyRent)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Deposit Held</p>
                <p className="font-mono font-semibold text-slate-900 tabular-nums">{formatINR(tenant.securityDeposit)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-start gap-2.5">
                <User className="mt-0.5 h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Assigned Property Manager</p>
                  <p className="font-medium text-slate-900">{property?.managerName || 'Rohan Mehta'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Lease Period</p>
                  <p className="font-medium text-slate-900 tabular-nums">
                    {formatDate(tenant.leaseStartDate)} – {formatDate(tenant.leaseEndDate)}
                  </p>
                </div>
              </div>
            </div>

            {property && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-medium text-slate-500">Included Building Amenities</p>
                <p className="mt-1 text-sm text-slate-700">{property.amenities.join(' · ')}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Property Enquiry / Visit Request</DialogTitle>
            <DialogDescription>
              Request a tour of another unit or transfer inquiry. Visit slots are confirmed only after Property Manager
              approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ten-visit-dt">Preferred Visit Date & Time</Label>
              <Input
                id="ten-visit-dt"
                type="datetime-local"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ten-visit-notes">Unit Preference / Notes</Label>
              <Textarea
                id="ten-visit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Interested in touring 3 BHK Unit B-602 for lease transfer..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnquiryOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={submitVisitEnquiry.isPending}
              onClick={() => submitVisitEnquiry.mutate()}
            >
              {submitVisitEnquiry.isPending ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
