'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  Database,
  Download,
  Globe,
  Lock,
  Pencil,
  Plane,
  Layers,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PageHeader, Toolbar, TwoColumns } from '@/shared/layout';
import { formatBytes, utf8Size } from '@/shared/lib';
import { useOutbox, useStorageEstimate } from '@/shared/offline';
import {
  Button,
  ButtonLink,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorNotice,
  FilterChips,
  SearchField,
  Segmented,
  SideCard,
  StatusBadge,
} from '@/shared/ui';

import { type Snippet, useMySnippets, useSnippetActions } from '../api';
import { SnippetCard } from './SnippetCard';

type Visibility = 'all' | 'public' | 'private';

function downloadJson(snippets: Snippet[]) {
  const blob = new Blob([JSON.stringify(snippets, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `afridev-coffre-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function MySnippetsScreen() {
  const snippets = useMySnippets();
  const pending = useOutbox('snippets').filter((entry) => entry.op === 'PUT');
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('all');
  const [language, setLanguage] = useState('all');

  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const snippet of snippets.items) counts.set(snippet.language, (counts.get(snippet.language) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [snippets.items]);

  const visible = snippets.items.filter((snippet) => {
    if (visibility === 'public' && !snippet.is_public) return false;
    if (visibility === 'private' && snippet.is_public) return false;
    if (language !== 'all' && snippet.language !== language) return false;
    if (!query.trim()) return true;
    const text = `${snippet.title} ${snippet.tags.join(' ')} ${snippet.content}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  const totalSize = snippets.items.reduce((sum, snippet) => sum + utf8Size(snippet.content), 0);
  const publicCount = snippets.items.filter((snippet) => snippet.is_public).length;

  return (
    <TwoColumns aside={<VaultAside count={snippets.items.length} size={totalSize} synced={snippets.source === 'local'} />}>
      <PageHeader
        className="mb-2"
        icon={<Code2 aria-hidden />}
        title="Snippets"
        description="Votre coffre : commandes, scripts et recettes d'intégration, accessibles même sans réseau."
        actions={
          <>
            <Button variant="ghost" onClick={() => downloadJson(snippets.items)} disabled={!snippets.items.length}>
              <Download className="size-4" aria-hidden /> Exporter
            </Button>
            <ButtonLink href="/snippets/new">
              <Plus className="size-4" aria-hidden /> Nouveau snippet
            </ButtonLink>
          </>
        }
      />
      <Toolbar>
        <Segmented
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'all', label: 'Tous', icon: <Layers aria-hidden />, count: snippets.items.length },
            { value: 'public', label: 'Publics', icon: <Globe aria-hidden />, count: publicCount },
            { value: 'private', label: 'Privés', icon: <Lock aria-hidden />, count: snippets.items.length - publicCount },
          ]}
        />
        <SearchField
          className="w-full sm:ml-auto sm:w-64"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Titre, fonction, tag…"
          aria-label="Rechercher dans mes snippets"
        />
      </Toolbar>
      {languages.length > 1 ? (
        <FilterChips
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'all', label: `Tous les langages (${snippets.items.length})` },
            ...languages.map(([lang, count]) => ({ value: lang, label: `${lang} (${count})` })),
          ]}
        />
      ) : null}

      {pending.map((entry) => (
        <Card key={entry.id} className="flex items-center gap-3 border-dashed p-4">
          <Clock className="size-4 text-offline" aria-hidden />
          <span className="flex-1 font-semibold">{String(entry.data.title)}</span>
          <StatusBadge tone="offline">En attente de réseau</StatusBadge>
        </Card>
      ))}

      {snippets.isPending ? (
        <>
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </>
      ) : snippets.isError && !snippets.items.length ? (
        <ErrorNotice message="Votre coffre s'affichera dès le retour du réseau, puis restera disponible hors ligne." />
      ) : !visible.length ? (
        <EmptyState
          icon={<Code2 className="size-8" aria-hidden />}
          title={snippets.items.length ? 'Aucun snippet ne correspond' : 'Votre coffre est vide'}
          action={<ButtonLink href="/snippets/new">Ajouter un snippet</ButtonLink>}
        >
          Gardez ici vos commandes Docker, scripts USSD ou recettes mobile money pour les retrouver même sans connexion.
        </EmptyState>
      ) : (
        visible.map((snippet) => <VaultSnippetCard key={snippet.id} snippet={snippet} />)
      )}
      {snippets.source === 'api' && snippets.remote.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => snippets.remote.fetchNextPage()} loading={snippets.remote.isFetchingNextPage}>
          Charger plus
        </Button>
      ) : null}
    </TwoColumns>
  );
}

function VaultSnippetCard({ snippet }: { snippet: Snippet }) {
  const { publish, remove } = useSnippetActions();
  const review = snippet.ai_review as { risky?: boolean; reasons?: string[] };
  const flagged = Boolean(review?.risky) && !snippet.is_public;
  const icon = 'flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-container hover:text-ink';

  return (
    <SnippetCard
      bookmark={false}
      previewLines={6}
      snippet={{ ...snippet, date: snippet.updated_at }}
      banner={
        flagged ? (
          <div className="flex gap-3 rounded-lg border border-danger/25 bg-danger-soft p-3 text-on-danger-soft">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-body-sm">
              <span className="font-semibold">Retiré de la publication : donnée sensible probable.</span>{' '}
              {review.reasons?.join(' ') ?? ''} Corrigez-le puis republiez.
            </p>
          </div>
        ) : null
      }
      badges={
        <>
          {snippet.is_public ? (
            <StatusBadge tone="primary" dot={false}><Globe className="size-3" aria-hidden /> Public</StatusBadge>
          ) : (
            <StatusBadge dot={false}><Lock className="size-3" aria-hidden /> Privé</StatusBadge>
          )}
          <StatusBadge tone="success" dot={false}><CheckCircle2 className="size-3" aria-hidden /> Dispo hors ligne</StatusBadge>
        </>
      }
      actions={
        <>
          <Link href={`/snippets/${snippet.id}/edit`} aria-label="Modifier" title="Modifier" className={icon}>
            <Pencil className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            aria-label="Supprimer"
            title="Supprimer"
            onClick={() => window.confirm('Supprimer ce snippet ?') && remove.mutate(snippet.id)}
            className={`${icon} hover:text-danger`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </>
      }
      footer={
        <>
          <Button
            variant={snippet.is_public ? 'outline' : 'secondary'}
            size="sm"
            loading={publish.isPending}
            onClick={() => publish.mutate({ id: snippet.id, value: !snippet.is_public })}
          >
            {snippet.is_public ? 'Rendre privé' : 'Publier'}
          </Button>
          {publish.isError ? <p className="basis-full text-body-sm text-danger">{publish.error.message}</p> : null}
        </>
      }
    />
  );
}

function VaultAside({ count, size, synced }: { count: number; size: number; synced: boolean }) {
  const storage = useStorageEstimate();
  return (
    <>
      <SideCard title="Mon coffre" icon={<Database aria-hidden />}>
        <div className="space-y-3 px-4 pb-4">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-label-md text-ink-faint">Snippets</dt>
              <dd className="text-headline-md text-ink tabular-nums">{count}</dd>
            </div>
            <div>
              <dt className="text-label-md text-ink-faint">Empreinte</dt>
              <dd className="text-headline-md text-ink tabular-nums">{formatBytes(size)}</dd>
            </div>
          </dl>
          {storage ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-label-md text-ink-faint">
                <span>Stockage local</span>
                <span className="tabular-nums">{formatBytes(storage.usage)} / 50 Mo</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-container-high">
                <div
                  className="h-full rounded-full bg-secondary"
                  style={{ width: `${Math.min(100, Math.max(2, (storage.usage / (50 * 1024 * 1024)) * 100))}%` }}
                />
              </div>
            </div>
          ) : null}
          <p className="flex items-center gap-2 text-body-sm text-ink-muted">
            <CheckCircle2 className="size-4 shrink-0 text-secondary-ink" aria-hidden />
            {synced ? 'Copie SQLite synchronisée' : 'Cache local actif'}
          </p>
          <p className="flex items-center gap-2 text-body-sm text-ink-muted">
            <ShieldCheck className="size-4 shrink-0 text-secondary-ink" aria-hidden /> Security Guard actif, même hors ligne
          </p>
        </div>
      </SideCard>
      <SideCard title="Mode voyageur / 2G" icon={<Plane aria-hidden />}>
        <p className="px-4 pb-4 text-body-sm text-ink-muted">
          Hors couverture, votre coffre reste consultable et modifiable : les changements partent dès que le réseau
          revient. Exportez-le en JSON pour une copie de secours.
        </p>
      </SideCard>
    </>
  );
}
