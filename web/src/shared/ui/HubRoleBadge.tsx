import { ShieldCheck } from 'lucide-react';

import { cn } from '@/shared/lib';

const LABELS: Record<string, string> = { creator: 'Créateur du hub', moderator: 'Modérateur' };

/** Rôle de l'auteur dans le hub du contenu (posts, questions, snippets) ; rien sinon. */
export function HubRoleBadge({ role, className }: { role?: string | null; className?: string }) {
  const label = role ? LABELS[role] : undefined;
  if (!label) return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-on-secondary-soft',
        className,
      )}
    >
      <ShieldCheck className="size-3" aria-hidden /> {label}
    </span>
  );
}
