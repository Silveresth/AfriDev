'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Children, Fragment, isValidElement, useState } from 'react';

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
  // Téléphone : le titre est dans l'en-tête d'écran (comme l'appli) ; ici ne restent que les actions.
  return (
    <header
      className={cn(
        'mb-6 flex flex-wrap items-center gap-x-4 gap-y-3',
        actions ? 'max-lg:mb-4' : 'max-lg:mb-0',
        className,
      )}
    >
      {icon ? (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink ring-1 ring-primary/15 max-lg:hidden [&_svg]:size-6">
          {icon}
        </span>
      ) : null}
      <div className="min-w-[14rem] flex-1 space-y-0.5 max-lg:sr-only">
        {eyebrow ? <p className="text-body-sm font-medium text-primary-ink">{eyebrow}</p> : null}
        <h1 className="text-headline-xl text-ink">{title}</h1>
        {description ? <p className="max-w-2xl text-body-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full shrink-0 flex-wrap gap-2 lg:w-auto">{actions}</div> : null}
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
        // Téléphone : onglets « Pour vous / Abonnements » de l'appli, collés sous l'en-tête de 56 px.
        'context-tabs sticky top-14 z-10 -mx-4 flex items-center justify-between border-b border-line bg-app px-3 transition-colors',
        'lg:top-16 lg:-mx-10 lg:mb-5 lg:bg-surface/95 lg:px-10 lg:backdrop-blur-md',
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
                'group relative inline-flex h-[42px] shrink-0 items-center gap-2 border-b-2 px-3 text-[13px] font-semibold whitespace-nowrap transition-all duration-150 lg:h-11 lg:text-body-sm lg:font-medium',
                active
                  ? 'border-ink text-ink lg:border-primary lg:font-bold'
                  : 'border-transparent text-ink-muted hover:text-ink lg:hover:border-line-strong',
              )}
            >
              {option.icon ? (
                <span
                  className={cn(
                    'transition-colors max-lg:hidden [&_svg]:size-4',
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
      {/* Les barres collantes pleine largeur (ContextTabs) s'arrêtent au bord de la colonne : sans
          ça, leur fond recouvrait le début des widgets de droite. */}
      <div className="min-w-0 space-y-4 xl:[&_.context-tabs]:mr-0 xl:[&_.context-tabs]:pr-0">{children}</div>
      <aside aria-label="Widgets" className="hidden min-w-0 lg:block xl:sticky xl:top-[5.5rem] xl:self-start xl:pb-4">
        <WidgetPager>{aside}</WidgetPager>
      </aside>
    </div>
  );
}

const WIDGETS_PER_PAGE = 2;

/** Widgets de droite par pages de deux (flèches ‹ ›) : jamais coupés en bas de l'écran. */
function WidgetPager({ children }: { children: React.ReactNode }) {
  const [page, setPage] = useState(0);
  const items = flattenFragments(children);
  const pages = Math.max(1, Math.ceil(items.length / WIDGETS_PER_PAGE));
  const current = Math.min(page, pages - 1);
  if (pages === 1) return <div className="space-y-4">{items}</div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-label-md text-ink-faint tabular-nums">
          {current + 1} / {pages}
        </span>
        <span className="flex items-center gap-1">
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Widgets, page ${index + 1}`}
              aria-current={index === current ? 'page' : undefined}
              onClick={() => setPage(index)}
              className={cn('h-1.5 rounded-full transition-all', index === current ? 'w-4 bg-primary' : 'w-1.5 bg-line-strong hover:bg-ink-faint')}
            />
          ))}
          <button
            type="button"
            aria-label="Widgets précédents"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="ml-1 flex size-7 items-center justify-center rounded-full text-ink-muted hover:bg-container hover:text-ink disabled:opacity-30"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Widgets suivants"
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
            className="flex size-7 items-center justify-center rounded-full text-ink-muted hover:bg-container hover:text-ink disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </span>
      </div>
      <div key={current} className="animate-pop space-y-4">
        {items.slice(current * WIDGETS_PER_PAGE, (current + 1) * WIDGETS_PER_PAGE)}
      </div>
    </div>
  );
}

/** <>{A}{B}</> → [A, B] : chaque widget compte pour un. */
function flattenFragments(node: React.ReactNode): React.ReactNode[] {
  return Children.toArray(node).flatMap((child) =>
    isValidElement<{ children?: React.ReactNode }>(child) && child.type === Fragment ? flattenFragments(child.props.children) : [child],
  );
}
