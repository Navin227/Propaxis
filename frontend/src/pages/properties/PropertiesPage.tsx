import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Edit3, Eye, LayoutGrid, List, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { propertyService } from '@/src/services/properties/propertyService';
import { usePermissions } from '@/src/hooks/usePermissions';
import { Property } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input, Label } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatINRCompact } from '@/src/utils/formatters';

const propertySchema = z.object({
  name: z.string().min(3, 'Property name is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  type: z.enum(['Residential Tower', 'Boutique Apartments', 'Serviced Residences']),
  state: z.string().trim().min(1, 'State is required').max(120),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  totalUnits: z.coerce.number().min(1, 'Must have at least 1 unit'),
  managerId: z.string().min(1, 'Assign a property manager'),
  status: z.enum(['Active', 'Maintenance']),
  monthlyTargetRent: z.coerce.number().min(10000),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export function PropertiesPage() {
  const { canCreateProperty, canAssignManagers } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const { data: properties = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyService.listOperationalProperties(),
  });

  const { data: managers = [] } = useQuery({
    queryKey: ['property-managers'],
    queryFn: () => propertyService.listManagers(),
  });

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema) as any,
    defaultValues: {
      name: '',
      address: '',
      city: 'Bengaluru',
      state: '',
      postalCode: '',
      type: 'Residential Tower',
      totalUnits: 12,
      managerId: '',
      status: 'Active',
      monthlyTargetRent: 600000,
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: PropertyFormValues) => propertyService.createProperty(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property added to portfolio');
      setModalOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: PropertyFormValues }) =>
      propertyService.updateProperty(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property details updated');
      setModalOpen(false);
      setEditingProperty(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreateModal = () => {
    setEditingProperty(null);
    form.reset({
      name: '',
      address: '',
      city: 'Bengaluru',
      state: '',
      postalCode: '',
      type: 'Residential Tower',
      totalUnits: 12,
      managerId: managers[0]?.id || '',
      status: 'Active',
      monthlyTargetRent: 600000,
    });
    setModalOpen(true);
  };

  const openEditModal = (prop: Property) => {
    setEditingProperty(prop);
    form.reset({
      name: prop.name,
      address: prop.address,
      city: prop.city,
      state: prop.state || '',
      postalCode: prop.postalCode || '',
      type: prop.type === 'Mixed-Use' ? 'Residential Tower' : prop.type,
      totalUnits: prop.totalUnits,
      managerId: prop.managerId,
      status: prop.status === 'Maintenance' ? 'Maintenance' : 'Active',
      monthlyTargetRent: prop.monthlyTargetRent,
    });
    setModalOpen(true);
  };

  const onSubmit = (values: PropertyFormValues) => {
    if (editingProperty) {
      updateMutation.mutate({ id: editingProperty.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.managerName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [properties, search, statusFilter]);

  if (isLoading) return <LoadingState rows={5} />;
  if (isError) return <ErrorState message="Failed to load properties." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Properties</h2>
          <p className="text-sm text-slate-500">
            {canCreateProperty
              ? 'Manage all portfolio buildings, occupancy levels, and manager assignments.'
              : 'Showing buildings assigned to your manager profile.'}
          </p>
        </div>

        {canCreateProperty && (
          <Button variant="primary" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        )}
      </div>

      {/* Filter & Layout Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search property, city, or manager..."
              className="pl-9"
            />
          </div>
          <div className="w-40">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Onboarding">Onboarding</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 self-start">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
              viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
              viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching properties"
          description="Try clearing your search filter or add a new property building."
          actionLabel={canCreateProperty ? 'Add Property' : undefined}
          onAction={canCreateProperty ? openCreateModal : undefined}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filtered.map((prop) => {
            const occPct = prop.totalUnits > 0 ? Math.round((prop.occupiedUnits / prop.totalUnits) * 100) : 0;
            return (
              <Card key={prop.id} className="overflow-hidden">
                <div className="relative aspect-[16/9] w-full bg-slate-100">
                  <img
                    src={prop.imageUrl}
                    alt={prop.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center -z-10 bg-slate-100 text-slate-400">
                    <Building2 className="h-10 w-10" />
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold text-slate-900 truncate">{prop.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {prop.address}, {prop.city}
                      </p>
                    </div>
                    <StatusTag label={prop.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{prop.type}</span>
                    <span aria-hidden="true">·</span>
                    <span>Manager: {prop.managerName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{formatINRCompact(prop.monthlyTargetRent)}/mo target</span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-center">
                    <div>
                      <p className="font-mono text-base font-semibold text-slate-900 tabular-nums">{prop.totalUnits}</p>
                      <p className="text-[11px] text-slate-500">Total Units</p>
                    </div>
                    <div>
                      <p className="font-mono text-base font-semibold text-emerald-700 tabular-nums">{prop.occupiedUnits}</p>
                      <p className="text-[11px] text-slate-500">Occupied ({occPct}%)</p>
                    </div>
                    <div>
                      <p className="font-mono text-base font-semibold text-amber-700 tabular-nums">{prop.vacantUnits}</p>
                      <p className="text-[11px] text-slate-500">Vacant</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button variant="outline" size="sm" onClick={() => openEditModal(prop)}>
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button variant="primary" size="sm" asChild>
                      <Link to={`/properties/${prop.id}`}>
                        <Eye className="h-3.5 w-3.5" />
                        View Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Occupied</TableHead>
                <TableHead className="text-right">Vacant</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((prop) => (
                <TableRow key={prop.id}>
                  <TableCell>
                    <p className="font-medium text-slate-900">{prop.name}</p>
                    <p className="text-xs text-slate-500">
                      {prop.address}, {prop.city}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{prop.type}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{prop.totalUnits}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-700 tabular-nums">{prop.occupiedUnits}</TableCell>
                  <TableCell className="text-right font-mono text-amber-700 tabular-nums">{prop.vacantUnits}</TableCell>
                  <TableCell>{prop.managerName}</TableCell>
                  <TableCell>
                    <StatusTag label={prop.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(prop)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/properties/${prop.id}`}>Details</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add / Edit Property Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
            <DialogDescription>
              {editingProperty
                ? 'Update property operational profile and manager assignment.'
                : 'Register a new building in the PropAxis portfolio.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="prop-name">Property Name</Label>
                <Input id="prop-name" {...form.register('name')} placeholder="e.g. Oakwood Residences" />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="prop-address">Street Address</Label>
                <Input id="prop-address" {...form.register('address')} placeholder="14th Main, Indiranagar" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prop-city">City</Label>
                <Input id="prop-city" {...form.register('city')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prop-state">State</Label>
                <Input
                  id="prop-state"
                  {...form.register('state')}
                  aria-invalid={Boolean(form.formState.errors.state)}
                />
                {form.formState.errors.state && (
                  <p className="text-xs text-red-600">{form.formState.errors.state.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prop-postal-code">Postal Code</Label>
                <Input
                  id="prop-postal-code"
                  {...form.register('postalCode')}
                  aria-invalid={Boolean(form.formState.errors.postalCode)}
                />
                {form.formState.errors.postalCode && (
                  <p className="text-xs text-red-600">{form.formState.errors.postalCode.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Property Type</Label>
                <Select
                  value={form.watch('type')}
                  onValueChange={(v) => form.setValue('type', v as PropertyFormValues['type'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Residential Tower">Residential Tower</SelectItem>
                    <SelectItem value="Boutique Apartments">Boutique Apartments</SelectItem>
                    <SelectItem value="Serviced Residences">Serviced Residences</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prop-units">Total Units</Label>
                <Input id="prop-units" type="number" {...form.register('totalUnits')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prop-target">Monthly Target Rent (INR)</Label>
                <Input id="prop-target" type="number" {...form.register('monthlyTargetRent')} />
              </div>

              <div className="space-y-1.5">
                <Label>Assigned Manager</Label>
                <Select
                  value={form.watch('managerId')}
                  onValueChange={(v) => form.setValue('managerId', v)}
                  disabled={!canAssignManagers}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Property Status</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(v) => form.setValue('status', v as PropertyFormValues['status'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
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
                {editingProperty ? 'Save Changes' : 'Create Property'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
