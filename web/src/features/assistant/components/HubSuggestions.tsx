'use client';

import { BadgeCheck, Sparkles } from 'lucide-react';

import { errorMessage } from '@/shared/api';

import { type SuggestedHub, useHubSuggestions } from '../api';

/**
 * Sous le choix du hub d'un post : l'IA propose les hubs qui correspondent au sujet (titre,
 * texte, tags). Un clic choisit le hub ; rien n'est demandé tant que le membre ne clique pas.
 */
export function HubSuggestions({
  title,
  body,
  tags,
  onPick,
}: {
  title: string;
  body: string;
  tags: string[];
  onPick: (hub: SuggestedHub) => void;
}) {
  const suggest = useHubSuggestions();
  const hubs = suggest.data?.hubs;
  const ready = title.trim().length >= 10;

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={!ready || suggest.isPending}
        onClick={() => suggest.mutate({ title, body: body.slice(0, 3000), tags })}
        title={ready ? undefined : 'Écrivez d’abord le titre du post'}
        className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary-ink hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline"
      >
        <Sparkles className="size-4" aria-hidden />
        {suggest.isPending ? 'Recherche du bon hub…' : hubs ? 'Proposer d’autres hubs' : 'Quel hub pour ce post ? (IA)'}
      </button>
      {suggest.isError ? <p className="text-body-sm text-danger">{errorMessage(suggest.error)}</p> : null}
      {hubs && !hubs.length ? <p className="text-body-sm text-ink-muted">Aucun hub ne correspond vraiment : publiez sans hub, ou créez-en un.</p> : null}
      {hubs?.length ? (
        <div className="flex flex-wrap gap-2">
          {hubs.map((hub) => (
            <button
              key={hub.id}
              type="button"
              onClick={() => onPick(hub)}
              className="flex max-w-full flex-col items-start rounded-xl border border-line bg-card px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/40"
            >
              <span className="flex items-center gap-1 text-body-sm font-semibold text-ink">
                h/{hub.slug}
                {hub.is_verified ? <BadgeCheck className="size-3.5 text-primary" aria-label="Hub vérifié" /> : null}
              </span>
              {hub.reason ? <span className="text-label-md text-ink-muted">{hub.reason}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
