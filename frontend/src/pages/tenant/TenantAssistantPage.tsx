import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bot, CalendarClock, HandHelping, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { inboxService } from '@/src/services/communication/inboxService';
import { tenantService } from '@/src/services/tenants/tenantService';
import { leasingService } from '@/src/services/leasing/leasingService';
import { AIOrchestratorResponse } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/input';
import { formatDateTime } from '@/src/utils/formatters';
import { cn } from '@/src/utils/cn';

interface ChatTurn {
  id: string;
  sender: 'tenant' | 'ai';
  text: string;
  timestamp: string;
  meta?: AIOrchestratorResponse['orchestrator'];
  error?: string;
}

const QUICK_PROMPTS = [
  'What is my current monthly rent due and lease expiry date?',
  'Show available 2 BHK or 3 BHK units in the portfolio.',
  'Check status of my open maintenance request MNT-4091.',
  'I want to schedule a visit to Oakwood Unit B-602.',
];

export function TenantAssistantPage() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitDate, setVisitDate] = useState('2026-11-17T11:30');
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: 'Hello! I am your PropAxis AI Assistant. I can check your rent balance, lease term, maintenance ticket status, available apartments for upgrade, or queue a property visit request for manager approval.',
      timestamp: new Date().toISOString(),
      meta: {
        routedAgent: 'Orchestrator Router',
        intent: 'session_greeting',
        confidence: 1,
        ragSources: ['Tenant Lease & Rent Index'],
      },
    },
  ]);

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.listTenants(),
  });
  const { data: threads = [] } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => inboxService.listThreads(),
  });

  const tenant = tenants[0];
  const myThread = threads[0];

  const askMutation = useMutation({
    mutationFn: (prompt: string) =>
      inboxService.invokeAssistant({
        message: prompt,
        channel: 'Portal',
        history: messages.map((m) => ({
          sender: m.sender === 'tenant' ? tenant?.name || 'Resident' : 'PropAxis AI',
          text: m.text,
        })),
      }),
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: res.reply,
          timestamp: res.generatedAt,
          meta: res.orchestrator,
        },
      ]);
    },
    onError: (err: Error) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: 'Unable to reach the backend AI Orchestrator.',
          error: err.message,
          timestamp: new Date().toISOString(),
        },
      ]);
      toast.error(err.message);
    },
  });

  const humanAssistMutation = useMutation({
    mutationFn: async () => {
      if (!myThread) throw new Error('No communication thread found.');
      return inboxService.sendMessage(myThread.id, {
        senderType: 'user',
        senderName: tenant?.name || 'Resident',
        channel: 'SMS',
        content: 'Resident requested human property manager assistance from AI Assistant portal.',
        requestHumanAssistance: true,
        humanReason: 'Tenant clicked Request Human Assistance inside Tenant AI Portal.',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Human assistance request sent to your Property Manager. AI remains available here.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const visitRequestMutation = useMutation({
    mutationFn: () => {
      if (!tenant) throw new Error('Tenant profile missing');
      return leasingService.createEnquiry({
        name: tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        preferredLocation: 'Indiranagar, Bengaluru',
        preferredConfig: '3 BHK',
        source: 'Website',
        assignedPropertyId: tenant.propertyId,
        visitRequestedDate: visitDate,
        notes: 'Submitted from Tenant AI Assistant portal.',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Visit request submitted! It is pending Property Manager approval.');
      setVisitModalOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSend = (text?: string) => {
    const query = (text ?? input).trim();
    if (!query || askMutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `usr-${Date.now()}`,
        sender: 'tenant',
        text: query,
        timestamp: new Date().toISOString(),
      },
    ]);
    if (!text) setInput('');
    askMutation.mutate(query);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">AI Resident Assistant</h1>
          <p className="text-sm text-slate-500">
            Backend-mediated assistant connected to your lease, rent ledger, and available property inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="min-h-[44px]" onClick={() => setVisitModalOpen(true)}>
            <CalendarClock className="h-4 w-4" />
            Request Property Visit
          </Button>
          <Button
            variant="outline"
            className="min-h-[44px]"
            disabled={humanAssistMutation.isPending}
            onClick={() => humanAssistMutation.mutate()}
          >
            <HandHelping className="h-4 w-4 text-amber-700" />
            Request Human Assistance
          </Button>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={askMutation.isPending}
            onClick={() => handleSend(q)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer text-left"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Viewport */}
      <Card className="flex flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 sm:p-5 min-h-[380px] max-h-[520px]">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex flex-col', m.sender === 'tenant' ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[90%] sm:max-w-[78%] rounded-2xl border px-4 py-3 text-sm',
                  m.sender === 'tenant'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : m.error
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-slate-200 bg-white text-slate-800'
                )}
              >
                <div
                  className={cn(
                    'mb-1 flex flex-wrap items-center gap-2 text-[11px]',
                    m.sender === 'tenant' ? 'text-slate-300' : 'text-slate-500'
                  )}
                >
                  <span className="inline-flex items-center gap-1 font-semibold">
                    {m.sender === 'ai' && <Bot className="h-3.5 w-3.5 text-blue-700" />}
                    {m.sender === 'tenant' ? tenant?.name || 'You' : 'PropAxis AI'}
                  </span>
                  {m.meta?.routedAgent && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-blue-700 font-medium">{m.meta.routedAgent}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatDateTime(m.timestamp)}</span>
                </div>

                {m.error ? (
                  <div className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600 shrink-0" />
                    <div>
                      <p className="font-semibold">{m.text}</p>
                      <p className="mt-0.5 text-red-700">{m.error}</p>
                    </div>
                  </div>
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                )}

                {m.meta?.proposedToolAction && (
                  <div className="mt-2.5 rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 text-xs text-blue-950">
                    <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Tool Action Proposed ({m.meta.proposedToolAction.type})</span>
                    </div>
                    <p className="mt-1">{m.meta.proposedToolAction.summary}</p>
                    {m.meta.proposedToolAction.requiresManagerApproval && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-amber-800 font-medium">
                          Requires Manager Approval before confirmation
                        </span>
                        <Button size="sm" variant="primary" onClick={() => setVisitModalOpen(true)}>
                          Submit Visit Request
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {askMutation.isPending && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Bot className="h-4 w-4 text-blue-700" />
              <span>Orchestrator Router processing via backend API...</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 border-t border-slate-200 bg-white p-3 sm:p-4"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your rent, lease, maintenance, or available apartments..."
            className="min-h-[44px]"
          />
          <Button
            type="submit"
            variant="primary"
            className="min-h-[44px] px-4"
            disabled={!input.trim() || askMutation.isPending}
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      </Card>

      <Dialog open={visitModalOpen} onOpenChange={setVisitModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Property Visit</DialogTitle>
            <DialogDescription>
              Submit a preferred visit date. Your request enters the Approvals queue and is not confirmed until
              approved by the Property Manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ai-visit-dt">Preferred Date & Time</Label>
            <Input
              id="ai-visit-dt"
              type="datetime-local"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={visitRequestMutation.isPending}
              onClick={() => visitRequestMutation.mutate()}
            >
              Submit for Manager Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
