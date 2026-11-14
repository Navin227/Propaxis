import { cn } from '@/src/utils/cn';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_MAP: Record<Tone, string> = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  danger: 'text-red-700 bg-red-50 border-red-200',
  info: 'text-blue-700 bg-blue-50 border-blue-200',
  neutral: 'text-slate-700 bg-slate-100 border-slate-200',
};

export function inferStatusTone(label: string): Tone {
  const s = label.toLowerCase();
  if (
    s.includes('paid') ||
    s.includes('active') ||
    s.includes('approved') ||
    s.includes('completed') ||
    s.includes('converted') ||
    s.includes('available') ||
    s.includes('verified')
  ) {
    return 'success';
  }
  if (
    s.includes('pending') ||
    s.includes('review') ||
    s.includes('requested') ||
    s.includes('progress') ||
    s.includes('expiring') ||
    s.includes('notice') ||
    s.includes('high') ||
    s.includes('invited')
  ) {
    return 'warning';
  }
  if (s.includes('overdue') || s.includes('rejected') || s.includes('urgent') || s.includes('lost') || s.includes('inactive')) {
    return 'danger';
  }
  if (s.includes('ai') || s.includes('assigned') || s.includes('suggested') || s.includes('leased')) {
    return 'info';
  }
  return 'neutral';
}

export function StatusTag({
  label,
  tone,
  showIcon = false,
  className,
}: {
  label: string;
  tone?: Tone;
  showIcon?: boolean;
  className?: string;
}) {
  const resolvedTone = tone ?? inferStatusTone(label);
  const Icon =
    resolvedTone === 'success'
      ? CheckCircle2
      : resolvedTone === 'warning'
        ? Clock
        : resolvedTone === 'danger'
          ? XCircle
          : AlertCircle;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0',
        TONE_MAP[resolvedTone],
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" />}
      <span>{label}</span>
    </span>
  );
}
