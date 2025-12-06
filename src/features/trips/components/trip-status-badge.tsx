import { cn } from '@/lib/utils';
import type { TripStatus } from '@/types/database';

type TripStatusBadgeProps = {
  status: TripStatus;
};

const statusStyles: Record<TripStatus, string> = {
  draft: 'bg-amber-500/10 text-amber-300 border border-amber-500/40',
  active: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40',
  completed: 'bg-slate-500/20 text-slate-200 border border-slate-500/40'
};

export function TripStatusBadge({ status }: TripStatusBadgeProps) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
        statusStyles[status]
      )}
    >
      {label}
    </span>
  );
}

