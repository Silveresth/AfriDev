import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib';

/** Carte encadrée façon shadcn/ui : fond carte, filet fin, ombre à peine visible, coins de 16 px. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-2xl border border-line bg-card shadow-card', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2 border-t border-line px-4 py-3 sm:px-5', className)} {...props} />;
}

/** Widget de colonne latérale : carte encadrée, titre discret en petites capitales. */
export function SideCard({
  title,
  icon,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-line bg-card shadow-card', className)}>
      {title ? (
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
          <h2 className="flex items-center gap-2 text-body-sm font-semibold text-ink">
            {icon ? <span className="text-ink-faint [&_svg]:size-4">{icon}</span> : null}
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function CardHeader({
  icon,
  title,
  subtitle,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-container-low text-ink-muted">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-headline-md text-ink">{title}</h2>
          {subtitle ? <p className="text-body-sm text-ink-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Titre de section discret (« COMMUNAUTÉS », « STACK TECHNIQUE »). */
export function Eyebrow({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p className={cn('text-label-md font-medium tracking-wide text-ink-faint uppercase', className)} {...props} />
  );
}

/** Filet de séparation (horizontal par défaut). */
export function Separator({ className, vertical = false }: { className?: string; vertical?: boolean }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn('shrink-0 bg-line', vertical ? 'h-full w-px' : 'h-px w-full', className)}
    />
  );
}

/** Touche de clavier (raccourcis : ⌘ K, N, Échap). */
export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded border border-line bg-container-low px-1 font-sans text-[0.6875rem] font-medium text-ink-faint',
        className,
      )}
      {...props}
    />
  );
}
