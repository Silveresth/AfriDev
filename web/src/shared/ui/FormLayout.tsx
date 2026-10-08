import { AlertCircle } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib';

import { Switch } from './Form';

/**
 * Formulaires de publication (question, snippet, projet, offre, événement) : une carte découpée en
 * sections titrées, séparées par un filet, et un pied d'actions sur fond légèrement grisé.
 */
export function FormCard({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-card', className)}
      {...props}
    />
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-5 px-5 py-6 sm:px-7', className)}>
      {title ? (
        <div className="space-y-0.5">
          <h2 className="text-headline-md text-ink">{title}</h2>
          {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Pied du formulaire : information à gauche (brouillon, rappel), actions à droite. */
export function FormFooter({ start, children, className }: { start?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-3 bg-container-low/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7',
        className,
      )}
    >
      <div className="min-w-0 text-body-sm text-ink-muted">{start}</div>
      <div className="flex flex-wrap justify-end gap-2">{children}</div>
    </div>
  );
}

/** Option activable (publier, recruter, télétravail…) : intitulé, explication et interrupteur. */
export function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3.5 rounded-xl border p-3.5 transition-colors',
        checked ? 'border-secondary/30 bg-secondary-soft/40' : 'border-line bg-container-low/60',
      )}
    >
      {icon ? (
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors [&_svg]:size-[18px]',
            checked ? 'bg-secondary-soft text-secondary-ink ring-secondary/25' : 'bg-card text-ink-faint ring-line',
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-ink">{title}</p>
        {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

/** Erreur d'envoi, sous les champs. */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-body-sm font-medium text-on-danger-soft">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Conseil de la colonne de droite d'un formulaire. */
export function TipCard({
  icon,
  title,
  children,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'primary';
}) {
  return (
    <section
      className={cn(
        'space-y-2 rounded-2xl border p-4',
        tone === 'primary' ? 'border-primary/20 bg-primary-soft/40' : 'border-line bg-card shadow-card',
      )}
    >
      <h2
        className={cn(
          'flex items-center gap-2 text-body-sm font-semibold [&_svg]:size-4',
          tone === 'primary' ? 'text-primary-ink' : 'text-ink',
        )}
      >
        {icon}
        {title}
      </h2>
      <div className="space-y-2 text-body-sm text-ink-muted">{children}</div>
    </section>
  );
}

/** Groupe de champs titré, sans carte (fenêtres de formulaire). */
export function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-label-md font-semibold text-ink-faint">{title}</legend>
      {children}
    </fieldset>
  );
}
