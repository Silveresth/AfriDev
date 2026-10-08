import { AlertTriangle, Inbox } from 'lucide-react';

import { cn } from '@/shared/lib';

/** Squelette de chargement : pas de spinner plein écran, la mise en page reste stable. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-container-high', className)} />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5" aria-busy>
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2.5 w-1/5" />
        </div>
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-card px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl border border-line bg-container-low text-ink-faint [&_svg]:size-6">
        {icon ?? <Inbox className="size-7" aria-hidden />}
      </span>
      <h3 className="text-headline-md text-ink">{title}</h3>
      {children ? <p className="max-w-md text-body-md text-ink-muted">{children}</p> : null}
      {action}
    </div>
  );
}

export function ErrorNotice({
  title = 'Impossible de charger ce contenu.',
  message,
  action,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger-soft p-4 text-on-danger-soft">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">{title}</p>
        {message ? <p className="text-body-sm">{message}</p> : null}
        {action}
      </div>
    </div>
  );
}