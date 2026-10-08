'use client';

import { ChevronDown, Search, X } from 'lucide-react';
import { useState } from 'react';

import { useDebounced } from '@/shared/hooks';
import { HubIcon, Input, Menu, useCloseMenu } from '@/shared/ui';

import { type Hub, useHubs, useMyHubs } from '../api';

export interface PickedHub {
  id: string;
  slug: string;
  name: string;
  icon: string;
}

export const toPickedHub = (hub: Hub): PickedHub => ({ id: hub.id, slug: hub.slug, name: hub.name, icon: hub.icon });

/** Choix du hub d'une publication (facultatif) : mes hubs d'abord, recherche parmi tous. */
export function HubPicker({ value, onChange }: { value: PickedHub | null; onChange: (hub: PickedHub | null) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Menu
        align="start"
        className="w-80 p-2"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-card pr-3 pl-1.5 text-body-sm font-medium text-ink shadow-card hover:bg-container-low"
          >
            {value ? (
              <HubIcon icon={value.icon} name={value.name} size={28} />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-md bg-container">
                <Search className="size-4 text-ink-muted" aria-hidden />
              </span>
            )}
            {value ? `h/${value.slug}` : 'Choisir un hub (facultatif)'}
            <ChevronDown className="size-4 text-ink-muted" aria-hidden />
          </button>
        )}
      >
        <HubChoices onPick={onChange} />
      </Menu>
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Publier hors hub"
          title="Publier hors hub"
          className="flex size-8 items-center justify-center rounded-lg text-ink-faint hover:bg-container hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function HubChoices({ onPick }: { onPick: (hub: PickedHub) => void }) {
  const close = useCloseMenu();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 250);
  const mine = useMyHubs();
  const search = useHubs({ q, sort: 'popular' }, { enabled: q.length > 0 });
  const popular = useHubs({ sort: 'popular' });
  const groups = q
    ? [{ title: 'Résultats', hubs: search.items }]
    : [
        { title: 'Mes hubs', hubs: mine.items },
        { title: 'Populaires', hubs: popular.items.filter((hub) => !hub.viewer?.is_member) },
      ];

  return (
    <div className="space-y-1">
      <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un hub" aria-label="Hub" />
      <div className="max-h-72 overflow-y-auto">
        {groups.map((group) =>
          group.hubs.length ? (
            <div key={group.title}>
              <p className="px-2 pt-2 pb-1 text-label-md font-medium text-ink-faint">{group.title}</p>
              <ul>
                {group.hubs.slice(0, 8).map((hub) => (
                  <li key={hub.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(toPickedHub(hub));
                        close();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-body-sm text-ink hover:bg-container"
                    >
                      <HubIcon icon={hub.icon} name={hub.name} size={26} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">h/{hub.slug}</span>
                        <span className="block truncate text-label-md text-ink-faint">{hub.name}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
        {q && !search.isPending && !search.items.length ? <p className="px-2 py-3 text-body-sm text-ink-muted">Aucun hub ne correspond.</p> : null}
      </div>
    </div>
  );
}
