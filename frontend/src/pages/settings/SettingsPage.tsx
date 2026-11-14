import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input, Label } from '@/src/components/ui/input';
import { Switch } from '@/src/components/ui/switch';
import { API_BASE_URL } from '@/src/services/api/client';

export function SettingsPage() {
  const [companyName, setCompanyName] = useState('PropAxis Residential Operations Pvt. Ltd.');
  const [gstin, setGstin] = useState('29AABCP4829K1Z5');
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [requireVisitApproval, setRequireVisitApproval] = useState(true);
  const [aiContinuousMode, setAiContinuousMode] = useState(true);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">Platform Settings</h2>
        <p className="text-sm text-slate-500">
          Configure company profile, notification channels, approval guardrails, and backend API connectivity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Profile</CardTitle>
          <CardDescription>Displayed on verified rent receipts and tenant lease reminders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Legal Entity Name</Label>
              <Input id="org-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-gst">GSTIN (India)</Label>
              <Input id="org-gst" value={gstin} onChange={(e) => setGstin(e.target.value)} className="font-mono" />
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => toast.success('Organization settings saved')}>
            Save Organization Profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Orchestration & Approval Policy</CardTitle>
          <CardDescription>
            Operational controls governing the Orchestrator Router, RAG, Tool Action, and Voice Synthesis agents
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100">
          <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
            <div>
              <p className="text-sm font-medium text-slate-900">Require Manager Approval for Property Visits</p>
              <p className="text-xs text-slate-500">
                AI Tool Action agent queues visits in Approvals; never auto-confirms without manager decision.
              </p>
            </div>
            <Switch checked={requireVisitApproval} onCheckedChange={setRequireVisitApproval} />
          </div>

          <div className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-slate-900">Keep AI Active During Human Assistance Requests</p>
              <p className="text-xs text-slate-500">
                Flags human escalation to property team without pausing automated multi-channel responses.
              </p>
            </div>
            <Switch checked={aiContinuousMode} onCheckedChange={setAiContinuousMode} />
          </div>

          <div className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-slate-900">Automated SMS & Email Rent Reminders</p>
              <p className="text-xs text-slate-500">
                Backend notification dispatcher triggers reminders 5 days prior to invoice due dates.
              </p>
            </div>
            <Switch checked={smsAlerts && emailAlerts} onCheckedChange={(v) => { setSmsAlerts(v); setEmailAlerts(v); }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backend & Desktop Runtime Readiness</CardTitle>
          <CardDescription>API endpoint binding for FastAPI or local Express middleware</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <span className="text-slate-600">Configured API Base URL</span>
            <span className="font-mono text-xs font-medium text-slate-900">{API_BASE_URL}</span>
          </div>
          <p className="text-xs text-slate-500">
            To connect a production FastAPI backend or package inside Electron, set <code className="font-mono">VITE_API_BASE_URL</code> in your environment configuration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
