'use client';

import {
  Code2,
  FolderGit2,
  HelpCircle,
  MessageSquarePlus,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { useLang } from '@/shared/i18n';
import { cn } from '@/shared/lib';

interface ActionItem {
  href: string;
  title: string;
  description: string;
  icon: typeof MessageSquarePlus;
  gradient: string;
  badge?: string;
  badgeColor?: string;
}

const ACTIONS: ActionItem[] = [
  {
    href: '/submit',
    title: 'Nouveau Post & Discussion',
    description: 'Partagez du code, une astuce, une architecture ou lancez un sondage.',
    icon: MessageSquarePlus,
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    href: '/questions/new',
    title: 'Poser une Question Dev (Q&A)',
    description: 'Blocage technique ? Obtenez une solution communautaire et une réponse IA rapide.',
    icon: HelpCircle,
    gradient: 'from-blue-500 to-indigo-600',
    badge: 'IA 5s',
    badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  },
  {
    href: '/snippets/new',
    title: 'Ajouter un Snippet de Code',
    description: 'Enregistrez un bloc de code (USSD, Orange Money, Flutter...) dans votre coffre hors-ligne.',
    icon: Code2,
    gradient: 'from-emerald-500 to-teal-700',
    badge: 'Offline',
    badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  {
    href: '/projects/new',
    title: 'Lancer un Projet Open Source',
    description: 'Présentez votre projet africain et recrutez des développeurs pour collaborer.',
    icon: FolderGit2,
    gradient: 'from-purple-500 to-pink-600',
    badge: 'Collab',
    badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  },
];

/**
 * Bottom Sheet tactile façon iOS / Android Native pour la création de contenu sur mobile.
 */
export function MobilePublishSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLang();

  // Bloque le défilement de l'arrière-plan quand ouvert
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Menu de création"
    >
      {/* Fond sombre et flouté */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Conteneur de la feuille glissante */}
      <div className="relative z-10 max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border-t border-line/70 bg-surface px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Poignée de glissement (Drag Handle) */}
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink-faint/30" />

        <div className="mb-4 flex items-center justify-between px-1">
          <div>
            <h3 className="text-headline-sm font-bold text-ink flex items-center gap-2">
              <Sparkles className="size-4.5 text-primary" aria-hidden />
              <span>Créer sur AfriDev</span>
            </h3>
            <p className="text-xs text-ink-muted">Partagez votre savoir avec les développeurs africains</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-8 items-center justify-center rounded-full bg-container-low text-ink-muted transition-colors hover:bg-container hover:text-ink active:scale-95"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* Grille des actions tactiles */}
        <div className="space-y-2.5 pb-2">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                onClick={onClose}
                className="group relative flex items-start gap-3.5 rounded-2xl border border-line bg-card/90 p-3.5 shadow-xs transition-all hover:border-line-strong hover:bg-container active:scale-[0.98]"
              >
                <div
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr text-white shadow-sm',
                    action.gradient,
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink group-hover:text-primary transition-colors">
                      {action.title}
                    </span>
                    {action.badge ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.2 text-[0.65rem] font-bold',
                          action.badgeColor,
                        )}
                      >
                        {action.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted line-clamp-2 leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
