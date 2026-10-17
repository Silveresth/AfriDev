'use client';

import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Code2,
  EyeOff,
  ExternalLink,
  FileText,
  FolderGit2,
  Layers,
  MessagesSquare,
  RotateCcw,
  Search,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useDebounced } from '@/shared/hooks';
import { PageHeader } from '@/shared/layout';
import { cn, formatCount } from '@/shared/lib';
import { Avatar, Button, Card, CardSkeleton, EmptyState, ErrorNotice, Input, Segmented, StatusBadge, Tabs, TimeAgo, useToast,
  Pagination,
} from '@/shared/ui';

import { type ContentAction, type ContentRow, type ContentType, useContent, useContentAction } from '../api';

type State = 'live' | 'removed';
type Meta = Record<string, string | number | boolean | null | undefined>;

const TYPES: Array<{ value: ContentType; label: string; icon: React.ReactNode }> = [
  { value: 'post', label: 'Posts', icon: <FileText className="size-4" aria-hidden /> },
  { value: 'question', label: 'Questions', icon: <MessagesSquare className="size-4" aria-hidden /> },
  { value: 'snippet', label: 'Snippets', icon: <Code2 className="size-4" aria-hidden /> },
  { value: 'project', label: 'Projets', icon: <FolderGit2 className="size-4" aria-hidden /> },
  { value: 'hub', label: 'Hubs', icon: <UsersRound className="size-4" aria-hidden /> },
  { value: 'job', label: 'Offres', icon: <BriefcaseBusiness className="size-4" aria-hidden /> },
  { value: 'event', label: 'Événements', icon: <CalendarDays className="size-4" aria-hidden /> },
];

/** Gestion des contenus : tout ce qui est publié, par type, avec masquage et rétablissement. */
export function ContentScreen() {
  const [type, setType] = useState<ContentType>('post');
  const [state, setState] = useState<State>('live');
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 400);
  const content = useContent({ type, state, q: q || undefined });

  return (
    <>
      <PageHeader
        eyebrow="Back-office"
        title="Contenus"
        description="Tout ce qui est publié sur la plateforme. Masquer retire un contenu du site et prévient son auteur ; il reste rétablissable."
      />
      <Tabs<ContentType> value={type} onChange={setType} options={TYPES} className="mb-4" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher par titre ou texte…"
            aria-label="Rechercher un contenu"
            className="pl-9"
          />
        </div>
        <Segmented<State>
          value={state}
          onChange={setState}
          options={[
            { value: 'live', label: 'En ligne' },
            { value: 'removed', label: 'Retirés' },
          ]}
        />
      </div>

      {content.isPending ? (
        <CardSkeleton lines={6} />
      ) : content.isError ? (
        <ErrorNotice title="Liste indisponible" message={errorMessage(content.error)} />
      ) : !content.items.length ? (
        <EmptyState icon={<Layers className="size-8" aria-hidden />} title={state === 'live' ? 'Aucun contenu' : 'Aucun contenu retiré'}>
          {q ? 'Essayez une autre recherche.' : 'Rien à afficher pour ce type.'}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="hidden overflow-x-auto lg:block">
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[18%]" />
              <col className="w-[11%]" />
              <col className="w-[15%]" />
              <col className="w-[22%]" />
            </colgroup>
            <thead className="border-b border-line bg-container-low text-label-md text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Contenu</th>
                <th className="px-4 py-3 font-medium">Auteur</th>
                <th className="px-4 py-3 font-medium">Publié</th>
                <th className="px-4 py-3 font-medium">Indicateurs</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {content.items.map((row) => (
                <tr key={row.id} className={cn('align-top', row.removed && 'bg-danger-soft/20')}>
                  <td className="px-4 py-3">
                    <Title row={row} />
                  </td>
                  <td className="px-4 py-3">
                    <Author row={row} />
                  </td>
                  <td className="px-4 py-3 text-body-sm whitespace-nowrap text-ink-muted">
                    <TimeAgo date={row.created_at} />
                  </td>
                  <td className="px-4 py-3">
                    <Facts row={row} />
                  </td>
                  <td className="px-4 py-3">
                    <Actions row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <ul className="divide-y divide-line lg:hidden">
            {content.items.map((row) => (
              <li key={row.id} className={cn('space-y-3 p-4', row.removed && 'bg-danger-soft/20')}>
                <Title row={row} />
                <div className="flex flex-wrap items-center gap-3">
                  <Author row={row} />
                  <TimeAgo date={row.created_at} className="text-label-md text-ink-faint" />
                </div>
                <Facts row={row} />
                <Actions row={row} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Pagination
        page={content.page}
        hasPrevious={content.hasPrevious}
        hasNext={content.hasNext}
        onPrevious={content.goPrevious}
        onNext={content.goNext}
        loading={content.isFetching}
      />
    </>
  );
}

function Title({ row }: { row: ContentRow }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="flex items-center gap-2">
        <span className="line-clamp-2 font-semibold text-ink">{row.title}</span>
        {row.removed ? <StatusBadge tone="danger">Retiré</StatusBadge> : null}
      </p>
      {row.excerpt ? <p className="line-clamp-2 text-body-sm text-ink-muted">{row.excerpt}</p> : null}
    </div>
  );
}

function Author({ row }: { row: ContentRow }) {
  if (!row.author) return <span className="text-body-sm text-ink-faint">Compte supprimé</span>;
  const name = row.author.display_name || row.author.username;
  return (
    <Link href={`/u/${row.author.username}`} className="flex min-w-0 items-center gap-2 hover:underline">
      <Avatar name={name} src={row.author.avatar_url} size={28} />
      <span className="truncate text-body-sm font-medium text-ink">{name}</span>
    </Link>
  );
}

function Facts({ row }: { row: ContentRow }) {
  const meta = row.meta as Meta;
  const facts: string[] = [];
  if (row.type === 'post') facts.push(`Score ${formatCount(Number(meta.score ?? 0))}`, `${formatCount(Number(meta.comments ?? 0))} comm.`);
  if (row.type === 'question') facts.push(`${formatCount(Number(meta.answers ?? 0))} réponse(s)`, meta.resolved ? 'Résolue' : 'Ouverte');
  if (row.type === 'snippet') facts.push(String(meta.language ?? ''), `${formatCount(Number(meta.comments ?? 0))} comm.`);
  if (row.type === 'project') facts.push(`★ ${formatCount(Number(meta.stars ?? 0))}`, meta.recruiting ? 'Recrute' : 'Complet');
  if (row.type === 'hub') facts.push(`${formatCount(Number(meta.members ?? 0))} membres`);
  if (row.type === 'job') facts.push(meta.active ? 'Active' : 'Clôturée', String(meta.location || (meta.remote ? 'Télétravail' : '')));
  if (row.type === 'event') facts.push(new Date(String(meta.starts_at)).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' }), String(meta.organizer ?? ''));
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-body-sm text-ink-muted">
      {row.type === 'hub' && meta.verified ? (
        <StatusBadge tone="primary" dot={false}>
          <BadgeCheck className="size-3" aria-hidden /> Certifié
        </StatusBadge>
      ) : null}
      {facts.filter(Boolean).map((fact) => (
        <span key={fact} className="rounded-md bg-container px-1.5 py-0.5 text-label-md">
          {fact}
        </span>
      ))}
    </div>
  );
}

function Actions({ row }: { row: ContentRow }) {
  const toast = useToast();
  const act = useContentAction();
  const meta = row.meta as Meta;
  const run = (action: ContentAction, confirm: string | null, done: string) => {
    if (confirm && !window.confirm(confirm)) return;
    act.mutate({ type: row.type, id: row.id, action }, { onSuccess: () => toast(done), onError: (error) => toast(errorMessage(error), 'error') });
  };

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {!row.removed ? (
        <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-body-sm font-medium text-ink-muted hover:bg-container hover:text-ink">
          <ExternalLink className="size-4" aria-hidden /> Voir
        </a>
      ) : null}
      {row.type === 'hub' && !row.removed ? (
        <Button
          variant="ghost"
          size="sm"
          loading={act.isPending}
          onClick={() => run(meta.verified ? 'unverify' : 'verify', null, meta.verified ? 'Certification retirée.' : 'Hub certifié.')}
        >
          <BadgeCheck className="size-4" aria-hidden /> {meta.verified ? 'Retirer la certification' : 'Certifier'}
        </Button>
      ) : null}
      {row.removed ? (
        <Button variant="secondary" size="sm" loading={act.isPending} onClick={() => run('restore', `Rétablir « ${row.title} » ?`, 'Contenu rétabli.')}>
          <RotateCcw className="size-4" aria-hidden /> Rétablir
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-danger hover:bg-danger-soft"
          loading={act.isPending}
          onClick={() => run('hide', `Masquer « ${row.title} » ? Il disparaît du site et son auteur est prévenu.`, 'Contenu masqué.')}
        >
          <EyeOff className="size-4" aria-hidden /> Masquer
        </Button>
      )}
    </div>
  );
}
