import { cn } from '@/shared/lib';

/**
 * En-tête de page : pastille d'icône (la même que dans la colonne de gauche), titre, promesse
 * en une ligne et actions à droite. Identique d'une rubrique à l'autre.
 */
export function PageHeader({
  eyebrow,
  icon,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-wrap items-center gap-x-4 gap-y-3', className)}>
      {icon ? (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink ring-1 ring-primary/15 [&_svg]:size-6">
          {icon}
        </span>
      ) : null}
      <div className="min-w-[14rem] flex-1 space-y-0.5">
        {eyebrow ? <p className="text-body-sm font-medium text-primary-ink">{eyebrow}</p> : null}
        <h1 className="text-headline-xl text-ink">{title}</h1>
        {description ? <p className="max-w-2xl text-body-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">{actions}</div> : null}
    </header>
  );
}

/** Barre d'outils sous l'en-tête : vues à gauche (Segmented), filtre ou recherche à droite. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

/** Largeur commune des pages de rubrique sans colonne de widgets (grilles : hubs, projets…). */
export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-[1040px]', className)}>{children}</div>;
}

/**
 * Colonne centrale (le fil) + colonne de droite (widgets : tendances, hubs, opportunités).
 * Côte à côte à partir de 1280 px (widgets collés sous l'en-tête) ; entre 1024 et 1280 px ils passent
 * sous le fil ; sur téléphone, le fil prend toute la place.
 */
export function TwoColumns({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  if (!aside) return <div className={cn('mx-auto max-w-3xl space-y-4', className)}>{children}</div>;
  return (
    <div className={cn('mx-auto grid max-w-[1040px] gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]', className)}>
      <div className="min-w-0 space-y-4">{children}</div>
      <aside
        aria-label="Widgets"
        className="scrollbar-none hidden space-y-4 lg:block xl:sticky xl:top-[5.5rem] xl:max-h-[calc(100dvh-6rem)] xl:self-start xl:overflow-y-auto xl:pb-4"
      >
        {aside}
      </aside>
    </div>
  );
}
