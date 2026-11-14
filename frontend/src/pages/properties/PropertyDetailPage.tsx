import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, User } from 'lucide-react';
import { propertyService } from '@/src/services/properties/propertyService';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatINR } from '@/src/utils/formatters';

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: property, isLoading: loadingProperty, isError, refetch } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertyService.getOperationalProperty(id!),
    enabled: Boolean(id),
  });

  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ['property-units', id],
    queryFn: () => propertyService.listOperationalPropertyUnits(id!),
    enabled: Boolean(id),
  });

  if (loadingProperty || loadingUnits) return <LoadingState rows={5} />;
  if (isError) return <ErrorState message="Failed to load property details." onRetry={() => refetch()} />;

  if (!property) {
    return (
      <ErrorState
        title="Property unavailable"
        message="This property either does not exist or is outside your assigned property permissions."
      />
    );
  }

  const propertyUnits = units.filter((u) => u.propertyId === property.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/properties">
            <ArrowLeft className="h-4 w-4" />
            Back to Properties
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-5 relative min-h-[240px] bg-slate-100">
            <img
              src={property.imageUrl}
              alt={property.name}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="lg:col-span-7 p-6 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-slate-900">{property.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>
                      {property.address}, {property.city}
                    </span>
                  </p>
                </div>
                <StatusTag label={property.status} showIcon />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {property.type}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Manager: {property.managerName}
                </span>
              </div>

              <div className="mt-5">
                <p className="text-xs font-medium text-slate-500">Building Amenities</p>
                <p className="mt-1 text-sm text-slate-700">{property.amenities.join(' · ')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
              <div>
                <p className="text-xs text-slate-500">Total Units</p>
                <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums">{property.totalUnits}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Occupied</p>
                <p className="font-mono text-lg font-semibold text-emerald-700 tabular-nums">{property.occupiedUnits}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Vacant</p>
                <p className="font-mono text-lg font-semibold text-amber-700 tabular-nums">{property.vacantUnits}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Target Monthly Rent</p>
                <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {formatINR(property.monthlyTargetRent)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Units in {property.name}</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/units">Manage All Units</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Configuration</TableHead>
                <TableHead className="text-right">Area</TableHead>
                <TableHead className="text-right">Monthly Rent</TableHead>
                <TableHead className="text-right">Security Deposit</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead>Tenant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {propertyUnits.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-mono font-medium text-slate-900">{unit.unitNumber}</TableCell>
                  <TableCell>
                    {unit.bedrooms} BHK · {unit.bathrooms} Bath ·{' '}
                    {unit.floor == null ? 'Floor —' : `Floor ${unit.floor}`}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{unit.areaSqFt} sq.ft</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatINR(unit.monthlyRent)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatINR(unit.securityDeposit)}</TableCell>
                  <TableCell>
                    <StatusTag label={unit.occupancyStatus} />
                  </TableCell>
                  <TableCell>{unit.tenantName || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
