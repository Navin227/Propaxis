import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Sparkles } from 'lucide-react';
import { analyticsService } from '@/src/services/approvals/approvalService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatINR } from '@/src/utils/formatters';

export function AnalyticsPage() {
  const { data: analytics, isLoading, isError, refetch } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsService.getSnapshot(),
  });

  if (isLoading) return <LoadingState rows={6} />;
  if (isError || !analytics) {
    return <ErrorState message="Failed to load portfolio analytics." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">Portfolio & Leasing Analytics</h2>
        <p className="text-sm text-slate-500">
          Verified operational metrics paired with clearly separated AI-generated recommendations.
        </p>
      </div>

      {/* Section 1: Actual Operational Metrics */}
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-slate-500">Verified Operational Metrics</p>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Occupancy & Vacancy Analytics</CardTitle>
              <CardDescription>6-month occupancy percentage vs vacant unit count</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.occupancyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" domain={[50, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="occupancyRate" name="Occupancy %" stroke="#1d4ed8" strokeWidth={2.5} />
                  <Line yAxisId="right" type="monotone" dataKey="vacantUnits" name="Vacant Units" stroke="#d97706" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enquiry Source Performance</CardTitle>
              <CardDescription>Total enquiries vs converted leases by channel</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.enquiryBySource} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="source" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="enquiries" name="Enquiries" fill="#0f172a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="converted" name="Converted" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Ageing Breakdown (INR)</CardTitle>
              <CardDescription>Outstanding rent receivables grouped by overdue duration</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.paymentAgeing} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val) => formatINR(Number(val ?? 0))} />
                  <Bar dataKey="amount" name="Outstanding INR" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maintenance Resolution Performance</CardTitle>
              <CardDescription>Average resolution time (hours) across trade categories</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.maintenanceByCategory} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${v}h`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val) => `${val ?? 0} hours`} />
                  <Bar dataKey="avgHours" name="Avg Resolution (Hours)" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Property-level comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>Property-Level Comparison</CardTitle>
          <CardDescription>Side-by-side operational scorecard across scoped buildings</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Occupancy Rate</TableHead>
                <TableHead className="text-right">Monthly Target Rent</TableHead>
                <TableHead className="text-right">Open Maintenance</TableHead>
                <TableHead className="text-right">Lead Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.propertyComparison.map((row) => (
                <TableRow key={row.propertyId}>
                  <TableCell className="font-medium text-slate-900">{row.propertyName}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{row.occupancyRate}%</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatINR(row.monthlyRevenue)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{row.openTickets}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{row.conversionRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section 2: Clearly Distinguished AI-Generated Insights */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-700" />
          <h3 className="font-display text-lg font-semibold text-slate-900">
            AI Operational Insights & Recommendations
          </h3>
          <span className="text-xs text-slate-500">
            · Generated by Intent Parser & RAG Agent (Advisory — requires manager review)
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {analytics.aiInsights.map((ins) => (
            <Card key={ins.id} className="border-blue-200/80 bg-blue-50/30 p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-blue-800">{ins.category}</span>
                <StatusTag
                  label={ins.severity === 'High' ? 'High Priority' : ins.severity}
                  tone={ins.severity === 'High' ? 'warning' : ins.severity === 'Opportunity' ? 'info' : 'neutral'}
                />
              </div>
              <h4 className="mt-2 font-display text-base font-semibold text-slate-900">{ins.title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{ins.observation}</p>
              <div className="mt-3 border-t border-blue-200/70 pt-2.5 text-xs">
                <span className="font-semibold text-slate-900">Suggested Action: </span>
                <span className="text-slate-700">{ins.recommendedAction}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
