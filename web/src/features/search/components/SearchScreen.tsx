'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Code2, Compass, FolderGit2, Layers, Lightbulb, MessagesSquare, Search, Sparkles, Type } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api, unwrap } from '@/shared/api';
import { useDebounced } from '@/shared/hooks';
import { PageHeader, Toolbar, TwoColumns } from '@/shared/layout';
import { CardSkeleton, EmptyState, ErrorNotice, SearchField, Segmented, SideCard } from '@/shared/ui';

type SourceType = 'all' | 'snippet' | 'question' | 'project';
type Mode = 'text' | 'semantic';

const SOURCES = {
  snippet: { icon: Code2, label: 'Snippet', tone: 'bg-primary-soft text-primary-ink' },
  question: { icon: MessagesSquare, label: 'Question résolue', tone: 'bg-secondary-soft text-on-secondary-soft' },
  project: { icon: FolderGit2, label: 'Projet', tone: 'bg-tertiary-soft text-on-tertiary-soft' },
};

const SUGGESTIONS = ['pagination Django', 'paiement mobile money', 'React Native hors ligne', 'déploiement Docker'];

/** Explorer : recherche dans la base de connaissances, tolérante aux fautes ou par le sens. */
export function SearchScreen({ aside }: { aside?: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get('q') ?? '';
  const type = (params.get('type') as SourceType | null) ?? 'all';
  const mode = (params.get('mode') as Mode | null) ?? 'text';
  const [draft, setDraft] = useState(q);
  const debounced = useDebounced(draft.trim(), 350);

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/search${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  // Recherche lancée d'ailleurs (palette ⌘K, lien partagé) : le champ suit l'adresse.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec l'adresse
    setDraft((current) => (current.trim() === q ? current : q));
  }, [q]);

  // La saisie met l'adresse à jour (partageable) après une courte pause.
  useEffect(() => {
    if (debounced !== q) update('q', debounced || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la saisie déclenche la mise à jour
  }, [debounced]);

  const results = useQuery({
    queryKey: ['search', q, type, mode],
    queryFn: () =>
      unwrap(
        api.GET('/api/knowledge/search/', {
          params: { query: { q, type: type === 'all' ? undefined : type, mode } },
        }),
      ),
    enabled: q.trim().length > 1,
    meta: { persist: false },
  });

  return (
    <TwoColumns aside={aside}>
      <PageHeader
        className="mb-2"
        icon={<Compass aria-hidden />}
        title="Explorer"
        description="Snippets publics, questions résolues et projets de toute la communauté."
      />
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          update('q', draft.trim() || null);
        }}
      >
        <SearchField
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Un bug, un code d'erreur, une techno…"
          aria-label="Rechercher dans la base de connaissances"
          className="[&_input]:h-12 [&_input]:text-body-lg"
        />
      </form>
      <Toolbar>
        <Segmented<SourceType>
          value={type}
          onChange={(value) => update('type', value === 'all' ? null : value)}
          options={[
            { value: 'all', label: 'Tout', icon: <Layers aria-hidden /> },
            { value: 'snippet', label: 'Snippets', icon: <Code2 aria-hidden /> },
            { value: 'question', label: 'Questions', icon: <MessagesSquare aria-hidden /> },
            { value: 'project', label: 'Projets', icon: <FolderGit2 aria-hidden /> },
          ]}
        />
        <Segmented<Mode>
          className="ml-auto"
          value={mode}
          onChange={(value) => update('mode', value === 'text' ? null : value)}
          options={[
            { value: 'text', label: 'Mots-clés', icon: <Type aria-hidden /> },
            { value: 'semantic', label: 'Par le sens', icon: <Sparkles aria-hidden /> },
          ]}
        />
      </Toolbar>

      {q.trim().length < 2 ? (
        <EmptyState
          icon={<Search aria-hidden />}
          title="Que cherchez-vous ?"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setDraft(suggestion)}
                  className="h-8 rounded-full border border-line bg-card px-3 text-body-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          }
        >
          Tapez au moins deux caractères, ou partez d&apos;une de ces recherches.
        </EmptyState>
      ) : results.isPending ? (
        <>
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </>
      ) : results.isError ? (
        <ErrorNotice message="La recherche nécessite une connexion." />
      ) : !results.data?.length ? (
        <EmptyState title="Aucun résultat">
          {mode === 'text' ? 'Essayez la recherche « Par le sens », ou d’autres mots-clés.' : 'Essayez d’autres mots, ou élargissez à « Tout ».'}
        </EmptyState>
      ) : (
        <section aria-label="Résultats" className="space-y-2">
          <p className="px-1 text-body-sm text-ink-faint">
            {results.data.length} résultat{results.data.length > 1 ? 's' : ''} pour « {q} »
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-card">
            {results.data.map((hit) => {
              const source = SOURCES[hit.source_type];
              return (
                <li key={`${hit.source_type}-${hit.source_id}`}>
                  <Link href={hit.url} className="group flex items-start gap-3.5 p-4 transition-colors hover:bg-container-low">
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${source.tone}`}>
                      <source.icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-label-md font-medium text-ink-faint">{source.label}</span>
                      <span className="block font-semibold text-ink group-hover:text-primary-ink">{hit.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-body-sm text-ink-muted">{hit.excerpt}</span>
                    </span>
                    <ChevronRight className="mt-2 size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </TwoColumns>
  );
}

/** Colonne de droite d'Explorer : comment tirer le meilleur des deux modes de recherche. */
export function SearchTipsCard() {
  return (
    <SideCard title="Bien chercher" icon={<Lightbulb aria-hidden />}>
      <ul className="space-y-3 px-4 pb-4 text-body-sm text-ink-muted">
        <li className="flex gap-2.5">
          <Type className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
          <span>
            <span className="font-medium text-ink">Mots-clés</span> tolère les fautes de frappe : idéal pour un code
            d&apos;erreur ou un nom de librairie.
          </span>
        </li>
        <li className="flex gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
          <span>
            <span className="font-medium text-ink">Par le sens</span> comprend une question en langage naturel, même
            sans les bons termes.
          </span>
        </li>
      </ul>
    </SideCard>
  );
}
