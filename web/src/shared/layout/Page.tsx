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

export interface ContextTabOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}

/**
 * Barre d'onglets contextuels épurée (style Google Docs / Drive sub-nav) :
 * - Fixée en position sticky sous la TopBar (sticky top-16)
 * - Indicateur actif sous forme de soulignement fin coloré avec police grasse
 * - Défilement horizontal fluide et masqué sur mobiles/écrans étroits
 */
export function ContextTabs<T extends string>({
  value,
  onChange,
  options,
  actions,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ContextTabOption<T>[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sticky top-16 z-10 -mx-6 mb-5 flex items-center justify-between border-b border-line bg-surface/95 px-6 backdrop-blur-md transition-colors sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10',
        className,
      )}
    >
      <nav
        role="tablist"
        aria-label="Onglets contextuels"
        className="scrollbar-none -mb-px flex gap-2 overflow-x-auto"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'group relative inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-body-sm font-medium whitespace-nowrap transition-all duration-150',
                active
                  ? 'border-primary text-ink font-bold'
                  : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {option.icon ? (
                <span
                  className={cn(
                    'transition-colors [&_svg]:size-4',
                    active ? 'text-primary' : 'text-ink-faint group-hover:text-ink',
                  )}
                >
                  {option.icon}
                </span>
              ) : null}
              <span>{option.label}</span>
              {option.count !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-label-sm tabular-nums transition-colors',
                    active ? 'bg-primary-soft text-primary-ink font-bold' : 'bg-container text-ink-muted',
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      {actions ? <div className="ml-3 flex shrink-0 items-center gap-2 py-1.5">{actions}</div> : null}
    </div>
  );
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
