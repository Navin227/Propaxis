import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Edit3, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { propertyService } from '@/src/services/properties/propertyService';
import { usePermissions } from '@/src/hooks/usePermissions';
import { Unit } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input, Label } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatINR } from '@/src/utils/formatters';

const unitSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  propertyId: z.string().min(1, 'Property is required'),
  floor: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : Number(value)),
    z.number().int().min(0).optional(),
  ),
  bedrooms: z.coerce.number().min(1).max(6),
  bathrooms: z.coerce.number().min(1).max(6),
  areaSqFt: z.coerce.number().min(200),
  monthlyRent: z.coerce.number().min(5000),
  securityDeposit: z.coerce.number().min(0),
  occupancyStatus: z.enum(['Occupied', 'Vacant', 'Under Notice']),
  availability: z.enum(['Available', 'Leased', 'Maintenance Hold']),
});

type UnitFormValues = z.infer<typeof unitSchema>;

export function UnitsPage() {
  const { canCreateUnit, canEditUnit, canArchiveUnit } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [occupancyFilter, setOccupancyFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const { data: units = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['units'],
    queryFn: () => propertyService.listOperationalUnits(),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyService.listOperationalProperties(),
  });

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema) as any,
    defaultValues: {
      unitNumber: '',
      propertyId: 'prop-1',
      floor: 1,
      bedrooms: 2,
      bathrooms: 2,
      areaSqFt: 1250,
      monthlyRent: 52000,
      securityDeposit: 180000,
      occupancyStatus: 'Vacant',
      availability: 'Available',
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: UnitFormValues) => propertyService.createUnit(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Unit created');
      setModalOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UnitFormValues }) =>
      propertyService.updateUnit(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Unit updated');
      setModalOpen(false);
      setEditingUnit(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => propertyService.archiveUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Unit archived');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingUnit(null);
    form.reset({
      unitNumber: '',
      propertyId: properties[0]?.id || 'prop-1',
      floor: 2,
      bedrooms: 2,
      bathrooms: 2,
      areaSqFt: 1250,
      monthlyRent: 52000,
      securityDeposit: 180000,
      occupancyStatus: 'Vacant',
      availability: 'Available',
    });
    setModalOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditingUnit(unit);
    form.reset({
      unitNumber: unit.unitNumber,
      propertyId: unit.propertyId,
      floor: unit.floor ?? undefined,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      areaSqFt: unit.areaSqFt,
      monthlyRent: unit.monthlyRent,
      securityDeposit: unit.securityDeposit,
      occupancyStatus: unit.occupancyStatus,
      availability: unit.availability,
    });
    setModalOpen(true);
  };

  const filtered = useMemo(() => {
    return units.filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        u.unitNumber.toLowerCase().includes(q) ||
        u.propertyName.toLowerCase().includes(q) ||
        (u.tenantName || '').toLowerCase().includes(q);
      const matchesProp = propertyFilter === 'all' || u.propertyId === propertyFilter;
      const matchesOcc = occupancyFilter === 'all' || u.occupancyStatus === occupancyFilter;
      return matchesSearch && matchesProp && matchesOcc;
    });
  }, [units, search, propertyFilter, occupancyFilter]);

  if (isLoading) return <LoadingState rows={6} />;
  if (isError) return <ErrorState message="Could not load unit inventory." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Units Inventory</h2>
          <p className="text-sm text-slate-500">
            Update rent, security deposit, occupancy, and leasing availability across apartments.
          </p>
        </div>

        {canCreateUnit && (
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Unit
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search unit number, property, or tenant..."
            className="pl-9"
          />
        </div>

        <div className="w-52">
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assigned Properties</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-40">
          <Select value={occupancyFilter} onValueChange={setOccupancyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Occupancy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Occupancy</SelectItem>
              <SelectItem value="Occupied">Occupied</SelectItem>
              <SelectItem value="Vacant">Vacant</SelectItem>
              <SelectItem value="Under Notice">Under Notice</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No units match your filters"
          description="Adjust property or occupancy filters to view apartment records."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit Number</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Beds / Baths</TableHead>
                <TableHead className="text-right">Area</TableHead>
                <TableHead className="text-right">Monthly Rent</TableHead>
                <TableHead className="text-right">Security Deposit</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell>
                    <p className="font-mono font-semibold text-slate-900">{unit.unitNumber}</p>
                    <p className="text-xs text-slate-500">
                      {unit.floor == null ? 'Floor —' : `Floor ${unit.floor}`}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-900">{unit.propertyName}</p>
                    {unit.tenantName && <p className="text-xs text-slate-500">Resident: {unit.tenantName}</p>}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {unit.bedrooms} BHK / {unit.bathrooms} BA
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{unit.areaSqFt} sq.ft</TableCell>
                  <TableCell className="text-right font-mono font-medium text-slate-900 tabular-nums">
                    {formatINR(unit.monthlyRent)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatINR(unit.securityDeposit)}
                  </TableCell>
                  <TableCell>
                    <StatusTag label={unit.occupancyStatus} />
                  </TableCell>
                  <TableCell>
                    <StatusTag label={unit.availability} />
                  </TableCell>
                  <TableCell className="text-right">
                    {canEditUnit && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(unit)}>
                        <Edit3 className="h-3.5 w-3.5" />
                        Update
                      </Button>
                    )}
                    {canArchiveUnit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => archiveMutation.mutate(unit.id)}
                        disabled={archiveMutation.isPending}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? `Update Unit ${editingUnit.unitNumber}` : 'Create New Unit'}</DialogTitle>
            <DialogDescription>
              {editingUnit
                ? 'Modify monthly rent, security deposit, occupancy, or leasing availability.'
                : 'Add a new apartment unit to a property.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((values) =>
              editingUnit
                ? updateMutation.mutate({ id: editingUnit.id, values })
                : createMutation.mutate(values)
            )}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-number">Unit Number</Label>
                <Input id="u-number" {...form.register('unitNumber')} disabled={Boolean(editingUnit)} />
              </div>

              <div className="space-y-1.5">
                <Label>Property</Label>
                <Select
                  value={form.watch('propertyId')}
                  onValueChange={(v) => form.setValue('propertyId', v)}
                  disabled={Boolean(editingUnit)}
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
                <Label htmlFor="u-floor">Floor (optional)</Label>
                <Input
                  id="u-floor"
                  type="number"
                  min={0}
                  step={1}
                  {...form.register('floor')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u-beds">Bedrooms</Label>
                <Input id="u-beds" type="number" {...form.register('bedrooms')} disabled={Boolean(editingUnit)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u-baths">Bathrooms</Label>
                <Input id="u-baths" type="number" {...form.register('bathrooms')} disabled={Boolean(editingUnit)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u-area">Area (sq.ft)</Label>
                <Input id="u-area" type="number" {...form.register('areaSqFt')} disabled={Boolean(editingUnit)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u-rent">Monthly Rent (INR)</Label>
                <Input id="u-rent" type="number" {...form.register('monthlyRent')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u-dep">Security Deposit (INR)</Label>
                <Input id="u-dep" type="number" {...form.register('securityDeposit')} />
              </div>

              <div className="space-y-1.5">
                <Label>Occupancy Status</Label>
                <Select
                  value={form.watch('occupancyStatus')}
                  onValueChange={(v) =>
                    form.setValue('occupancyStatus', v as UnitFormValues['occupancyStatus'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Occupied">Occupied</SelectItem>
                    <SelectItem value="Vacant">Vacant</SelectItem>
                    <SelectItem value="Under Notice">Under Notice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Availability</Label>
                <Select
                  value={form.watch('availability')}
                  onValueChange={(v) => form.setValue('availability', v as UnitFormValues['availability'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Leased">Leased</SelectItem>
                    <SelectItem value="Maintenance Hold">Maintenance Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingUnit ? 'Save Unit Changes' : 'Create Unit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
