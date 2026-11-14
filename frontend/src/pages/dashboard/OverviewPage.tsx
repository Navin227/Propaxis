import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, CalendarClock, CheckSquare, Clock } from 'lucide-react';
import { propertyService } from '@/src/services/properties/propertyService';
import { leasingService } from '@/src/services/leasing/leasingService';
import { maintenanceService } from '@/src/services/maintenance/maintenanceService';
import { paymentService } from '@/src/services/payments/paymentService';
import { approvalService, analyticsService } from '@/src/services/approvals/approvalService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatDateTime, formatINR, formatINRCompact, formatRelativeTime } from '@/src/utils/formatters';

export function OverviewPage() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('6m');

  const propertiesQuery = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyService.listProperties(),
  });
  const unitsQuery = useQuery({
    queryKey: ['units'],
    queryFn: () => propertyService.listUnits(),
  });
  const enquiriesQuery = useQuery({
    queryKey: ['enquiries'],
    queryFn: () => leasingService.listEnquiries(),
  });
  const maintenanceQuery = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => maintenanceService.listTickets(),
  });
  const paymentsQuery = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentService.listPayments(),
  });
  const approvalsQuery = useQuery({
    queryKey: ['approvals'],
    queryFn: () => approvalService.listApprovals(),
  });
  const analyticsQuery = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsService.getSnapshot(),
  });

  const isLoading =
    propertiesQuery.isLoading ||
    unitsQuery.isLoading ||
    paymentsQuery.isLoading ||
    analyticsQuery.isLoading;

  const isError = propertiesQuery.isError || analyticsQuery.isError;

  const properties = propertiesQuery.data ?? [];
  const filteredProperties = useMemo(
    () =>
      selectedPropertyId === 'all'
        ? properties
        : properties.filter((p) => p.id === selectedPropertyId),
    [properties, selectedPropertyId]
  );

  const filteredPayments = useMemo(() => {
    const all = paymentsQuery.data ?? [];
    return selectedPropertyId === 'all'
      ? all
      : all.filter((p) => p.propertyId === selectedPropertyId);
  }, [paymentsQuery.data, selectedPropertyId]);

  const filteredEnquiries = useMemo(() => {
    const all = enquiriesQuery.data ?? [];
    return selectedPropertyId === 'all'
      ? all
      : all.filter(
          (e) =>
            e.assignedPropertyId === selectedPropertyId ||
            e.matchedPropertyIds.includes(selectedPropertyId)
        );
  }, [enquiriesQuery.data, selectedPropertyId]);

  const filteredMaintenance = useMemo(() => {
    const all = maintenanceQuery.data ?? [];
    return selectedPropertyId === 'all'
      ? all
      : all.filter((m) => m.propertyId === selectedPropertyId);
  }, [maintenanceQuery.data, selectedPropertyId]);

  const filteredApprovals = useMemo(() => {
    const all = approvalsQuery.data ?? [];
    return (selectedPropertyId === 'all'
      ? all
      : all.filter((a) => a.propertyId === selectedPropertyId)
    ).filter((a) => a.status === 'Pending');
  }, [approvalsQuery.data, selectedPropertyId]);

  if (isLoading) return <LoadingState rows={6} />;
  if (isError) {
    return (
      <ErrorState
        message="Could not fetch portfolio overview metrics from the API."
        onRetry={() => {
          propertiesQuery.refetch();
          analyticsQuery.refetch();
        }}
      />
    );
  }

  const totalProperties = filteredProperties.length;
  const totalUnits = filteredProperties.reduce((sum, p) => sum + p.totalUnits, 0);
  const occupiedUnits = filteredProperties.reduce((sum, p) => sum + p.occupiedUnits, 0);
  const vacantUnits = filteredProperties.reduce((sum, p) => sum + p.vacantUnits, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const rentCollected = filteredPayments
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);
  const pendingRent = filteredPayments
    .filter((p) => p.status !== 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);
  const activeEnquiries = filteredEnquiries.filter(
    (e) => e.status !== 'Converted' && e.status !== 'Lost'
  ).length;
  const openMaintenance = filteredMaintenance.filter(
    (m) => m.status !== 'Completed' && m.status !== 'Rejected'
  ).length;

  const analytics = analyticsQuery.data!;
  const rentChartData =
    dateRange === '30d'
      ? analytics.monthlyRentSeries.slice(-2)
      : dateRange === '3m'
        ? analytics.monthlyRentSeries.slice(-3)
        : analytics.monthlyRentSeries;

  const upcomingVisits = filteredEnquiries.filter((e) => e.visitRequestedDate);

  const kpis = [
    { label: 'Total Properties', value: String(totalProperties), meta: 'Managed portfolio' },
    { label: 'Total Units', value: String(totalUnits), meta: `${occupiedUnits} leased · ${vacantUnits} vacant` },
    { label: 'Occupied Units', value: String(occupiedUnits), meta: 'Active leases' },
    { label: 'Vacant Units', value: String(vacantUnits), meta: 'Ready & hold units' },
    { label: 'Occupancy Rate', value: `${occupancyRate}%`, meta: 'Across scoped units' },
    { label: 'Rent Collected', value: formatINRCompact(rentCollected), meta: formatINR(rentCollected) },
    { label: 'Pending Rent', value: formatINRCompact(pendingRent), meta: formatINR(pendingRent) },
    { label: 'Active Enquiries', value: String(activeEnquiries), meta: 'Across 4 channels' },
    { label: 'Open Maintenance', value: String(openMaintenance), meta: 'Active service tickets' },
  ];

  const recentActivities = [
    ...filteredPayments
      .filter((p) => p.paidDate)
      .map((p) => ({
        id: `act-pay-${p.id}`,
        title: `Rent Verified — ${p.tenantName} (${p.unitNumber})`,
        detail: `${formatINR(p.amount)} via ${p.method ?? 'Gateway'}`,
        time: p.paidDate!,
      })),
    ...filteredMaintenance.map((m) => ({
      id: `act-mnt-${m.id}`,
      title: `${m.requestCode} · ${m.category} (${m.status})`,
      detail: `${m.propertyName} Unit ${m.unitNumber}`,
      time: m.submittedAt,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Workspace Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Portfolio Operations Overview</h2>
          <p className="text-sm text-slate-500">
            Real-time occupancy, rent collections in INR, leasing pipeline, and approval queues.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-52">
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by property" />
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
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 9 KPI Grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-slate-500 truncate tabular-nums">{kpi.meta}</p>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Rent Collection (INR)</CardTitle>
            <CardDescription>Verified collections against pending dues across billing cycles</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rentChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `₹${Math.round(v / 100000)}L`}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(val) => formatINR(Number(val ?? 0))} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="collected" name="Collected" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Occupancy Trend</CardTitle>
            <CardDescription>Monthly occupancy rate percentage and vacant unit count</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.occupancyTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[60, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(val, name) => (name === 'Occupancy %' ? `${val ?? 0}%` : String(val ?? 0))} />
                <Area
                  type="monotone"
                  dataKey="occupancyRate"
                  name="Occupancy %"
                  stroke="#0f172a"
                  fill="#dbeafe"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enquiry Conversion Pipeline</CardTitle>
            <CardDescription>Consolidated prospects across Website, Voice, SMS, and Email</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.enquiryConversion} layout="vertical" margin={{ top: 4, right: 16, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={110}
                  tick={{ fontSize: 12, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey="count" name="Leads" fill="#1e40af" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance Request Distribution</CardTitle>
            <CardDescription>Open vs completed tickets by trade category</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.maintenanceByCategory} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="open" name="Open" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Operational Feeds Row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Pending Approvals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Actions requiring manager sign-off</CardDescription>
            </div>
            <Link to="/approvals" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
              Review all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {filteredApprovals.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">All approval items are cleared.</p>
            ) : (
              filteredApprovals.slice(0, 4).map((apr) => (
                <div key={apr.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">{apr.type}</span>
                    <StatusTag label="Pending Approval" tone="warning" showIcon />
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900">{apr.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{apr.propertyName}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming Property Visits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Property Visits</CardTitle>
              <CardDescription>Visits confirm only after approval</CardDescription>
            </div>
            <Link to="/leasing" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
              Pipeline <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {upcomingVisits.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No scheduled or requested visits.</p>
            ) : (
              upcomingVisits.map((visit) => (
                <div key={visit.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{visit.name}</span>
                    <StatusTag
                      label={visit.status === 'Visit Approved' ? 'Confirmed' : 'Awaiting Approval'}
                      tone={visit.status === 'Visit Approved' ? 'success' : 'warning'}
                      showIcon
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                    <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{formatDateTime(visit.visitRequestedDate!)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{visit.preferredLocation}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest verified ledger & service updates</CardDescription>
            </div>
            <CheckSquare className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {recentActivities.map((act) => (
              <div key={act.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-slate-900">{act.title}</p>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{act.detail}</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(act.time)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
