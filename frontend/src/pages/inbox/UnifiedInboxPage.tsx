import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bot,
  Building2,
  HandHelping,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Send,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { inboxService } from '@/src/services/communication/inboxService';
import { useAuth } from '@/src/contexts/AuthContext';
import { ChannelType, InboxThread } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Input, Textarea } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatDateTime, formatRelativeTime } from '@/src/utils/formatters';
import { cn } from '@/src/utils/cn';

const CHANNEL_ICON: Record<ChannelType, React.ComponentType<{ className?: string }>> = {
  Voice: Phone,
  SMS: MessageSquare,
  Email: Mail,
};

export function UnifiedInboxPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | ChannelType>('all');
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [replyChannel, setReplyChannel] = useState<ChannelType>('SMS');
  const [composerText, setComposerText] = useState('');

  const { data: threads = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => inboxService.listThreads(),
  });

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch =
        t.contactName.toLowerCase().includes(q) ||
        t.propertyName.toLowerCase().includes(q) ||
        t.aiSummary.toLowerCase().includes(q);
      const matchesChan = channelFilter === 'all' || t.activeChannels.includes(channelFilter);
      return matchesSearch && matchesChan;
    });
  }, [threads, search, channelFilter]);

  useEffect(() => {
    if (!selectedThreadId && filteredThreads.length > 0) {
      setSelectedThreadId(filteredThreads[0].id);
      setReplyChannel(filteredThreads[0].primaryChannel);
    }
  }, [filteredThreads, selectedThreadId]);

  const activeThread: InboxThread | undefined =
    threads.find((t) => t.id === selectedThreadId) || filteredThreads[0];

  const sendMessageMutation = useMutation({
    mutationFn: (payload: {
      threadId: string;
      senderType: 'user' | 'manager';
      senderName: string;
      channel: ChannelType;
      content: string;
      requestHumanAssistance?: boolean;
      humanReason?: string;
    }) =>
      inboxService.sendMessage(payload.threadId, {
        senderType: payload.senderType,
        senderName: payload.senderName,
        channel: payload.channel,
        content: payload.content,
        requestHumanAssistance: payload.requestHumanAssistance,
        humanReason: payload.humanReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setComposerText('');
      toast.success('Message delivered & synchronized across thread');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const aiReplyMutation = useMutation({
    mutationFn: (thread: InboxThread) => {
      const lastUserMsg = [...thread.messages].reverse().find((m) => m.senderType === 'user');
      return inboxService.invokeAssistant({
        message:
          lastUserMsg?.content ||
          `Follow up with ${thread.contactName} regarding ${thread.propertyName}.`,
        channel: replyChannel,
        threadId: thread.id,
        history: thread.messages.map((m) => ({ sender: m.senderName, text: m.content })),
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      toast.success(`AI reply routed via ${res.orchestrator.routedAgent}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <LoadingState rows={6} />;
  if (isError) return <ErrorState message="Failed to load Unified Communication Inbox." onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Unified Communication Inbox</h2>
          <p className="text-sm text-slate-500">
            Synchronized Voice, SMS, and Email conversations with continuous AI assistance and team escalation monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as 'all' | ChannelType)}>
            <SelectTrigger className="w-40 bg-white">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="Voice">Voice Calls</SelectItem>
              <SelectItem value="SMS">SMS</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3-Panel Unified Inbox Shell */}
      <div className="grid min-h-[680px] grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-12">
        {/* Left Panel: Conversation List */}
        <div className="border-b border-slate-200 lg:col-span-3 lg:border-b-0 lg:border-r flex flex-col">
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="h-9 pl-9 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[300px] lg:max-h-[620px]">
            {filteredThreads.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No matching threads.</div>
            ) : (
              filteredThreads.map((thr) => {
                const active = activeThread?.id === thr.id;
                const lastMsg = thr.messages[thr.messages.length - 1];
                return (
                  <button
                    key={thr.id}
                    type="button"
                    onClick={() => {
                      setSelectedThreadId(thr.id);
                      setReplyChannel(thr.primaryChannel);
                    }}
                    className={cn(
                      'flex w-full flex-col gap-1.5 p-3.5 text-left transition-colors cursor-pointer',
                      active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-slate-900 truncate">{thr.contactName}</span>
                      <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                        {formatRelativeTime(thr.lastMessageAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate">
                        {thr.contactType} · {thr.propertyName} {thr.unitNumber ? `(${thr.unitNumber})` : ''}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">{lastMsg?.content}</p>

                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        {thr.activeChannels.map((ch) => {
                          const Icon = CHANNEL_ICON[ch];
                          return (
                            <span
                              key={ch}
                              title={`Active on ${ch}`}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-600"
                            >
                              <Icon className="h-3 w-3" />
                              {ch}
                            </span>
                          );
                        })}
                      </div>
                      {thr.aiStatus === 'Human Assistance Requested' && (
                        <StatusTag label="Human Requested" tone="warning" showIcon />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Middle Panel: Synchronized Multi-Channel Thread */}
        <div className="flex flex-col border-b border-slate-200 lg:col-span-6 lg:border-b-0 lg:border-r">
          {!activeThread ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState title="Select a conversation" description="Choose a contact thread from the left panel." />
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      {activeThread.contactName}
                    </h3>
                    <StatusTag label="AI Active" tone="info" />
                    {activeThread.aiStatus === 'Human Assistance Requested' && (
                      <StatusTag label="Human Assistance Requested" tone="warning" showIcon />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Synchronized history across {activeThread.activeChannels.join(' · ')} — AI stays active while team
                    monitors
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={aiReplyMutation.isPending}
                  onClick={() => aiReplyMutation.mutate(activeThread)}
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-700" />
                  {aiReplyMutation.isPending ? 'Generating...' : 'Trigger Backend AI Reply'}
                </Button>
              </div>

              {/* Human Request Alert Banner (does NOT pause AI) */}
              {activeThread.aiStatus === 'Human Assistance Requested' && (
                <div className="border-b border-amber-200 bg-amber-50/70 px-5 py-2.5 text-xs text-amber-900 flex items-start gap-2">
                  <HandHelping className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
                  <div>
                    <span className="font-semibold">Human Assistance Requested: </span>
                    <span>{activeThread.humanRequestReason}</span>
                    <span className="ml-1 text-amber-700">(AI remains active for routine queries)</span>
                  </div>
                </div>
              )}

              {/* Messages Timeline */}
              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-5 max-h-[430px]">
                {activeThread.messages.map((msg) => {
                  const Icon = CHANNEL_ICON[msg.channel];
                  const isExternal = msg.senderType === 'user';
                  const isAI = msg.senderType === 'ai';
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex flex-col', isExternal ? 'items-start' : 'items-end')}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] rounded-xl border px-4 py-3 text-sm',
                          isExternal
                            ? 'border-slate-200 bg-white text-slate-800'
                            : isAI
                              ? 'border-blue-200 bg-blue-50/70 text-slate-900'
                              : 'border-slate-800 bg-slate-900 text-white'
                        )}
                      >
                        <div
                          className={cn(
                            'mb-1.5 flex flex-wrap items-center gap-2 text-[11px]',
                            isExternal || isAI ? 'text-slate-500' : 'text-slate-300'
                          )}
                        >
                          <span className="inline-flex items-center gap-1 font-semibold">
                            {isAI && <Bot className="h-3.5 w-3.5 text-blue-700" />}
                            {msg.senderName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            {msg.channel}
                          </span>
                          {msg.aiAgentTag && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-blue-700 font-medium">{msg.aiAgentTag}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{formatDateTime(msg.timestamp)}</span>
                        </div>

                        {msg.transcriptNote && (
                          <p className="mb-1.5 rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">
                            {msg.transcriptNote}
                          </p>
                        )}
                        <p className="leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer */}
              <div className="border-t border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 mr-1">Reply via:</span>
                    {(['SMS', 'Email', 'Voice'] as ChannelType[]).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setReplyChannel(ch)}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                          replyChannel === ch
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      sendMessageMutation.mutate({
                        threadId: activeThread.id,
                        senderType: 'user',
                        senderName: activeThread.contactName,
                        channel: replyChannel,
                        content: 'I would like to speak with a property manager about custom lease terms.',
                        requestHumanAssistance: true,
                        humanReason: 'External contact requested human assistance via portal.',
                      })
                    }
                    className="text-xs font-medium text-amber-700 hover:underline cursor-pointer"
                  >
                    Simulate External Human Request
                  </button>
                </div>

                <div className="flex gap-2">
                  <Textarea
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder={`Send manager response via ${replyChannel}...`}
                    className="min-h-[64px] resize-none"
                  />
                  <Button
                    variant="primary"
                    className="self-end"
                    disabled={!composerText.trim() || sendMessageMutation.isPending}
                    onClick={() =>
                      sendMessageMutation.mutate({
                        threadId: activeThread.id,
                        senderType: 'manager',
                        senderName: user.name,
                        channel: replyChannel,
                        content: composerText.trim(),
                      })
                    }
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Panel: Contact, AI Summary & Related Property Context */}
        <div className="lg:col-span-3 p-4 space-y-5 bg-white">
          {activeThread && (
            <>
              <div>
                <p className="text-xs font-medium text-slate-500">Contact Profile</p>
                <h4 className="mt-1 font-display text-base font-semibold text-slate-900">
                  {activeThread.contactName}
                </h4>
                <p className="text-xs text-slate-500">{activeThread.contactType}</p>
                <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                  <p className="font-mono">{activeThread.contactPhone}</p>
                  <p className="truncate">{activeThread.contactEmail}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Conversation Summary</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{activeThread.aiSummary}</p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-medium text-slate-500">Related Property</p>
                <div className="mt-2 flex items-start gap-2.5">
                  <Building2 className="mt-0.5 h-4 w-4 text-slate-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900">{activeThread.propertyName}</p>
                    <p className="text-slate-500">
                      {activeThread.unitNumber ? `Unit ${activeThread.unitNumber}` : 'General Enquiry'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs font-medium text-slate-500">Workflow Actions</p>
                {activeThread.contactType === 'Lead' ? (
                  <>
                    <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                      <Link to="/leasing">
                        <UserCheck className="h-3.5 w-3.5" />
                        Open in Leasing Pipeline
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                      <Link to="/approvals">
                        <Sparkles className="h-3.5 w-3.5" />
                        Review Visit Approvals
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                    <Link to={`/tenants/${activeThread.contactId}`}>
                      <UserCheck className="h-3.5 w-3.5" />
                      View Tenant Profile
                    </Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
