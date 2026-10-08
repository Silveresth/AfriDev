'use client';

import { CheckCircle2, Copy, GitBranch, History, Lock, Pencil, WifiOff } from 'lucide-react';
import Link from 'next/link';

import { useSession } from '@/shared/session';
import { formatBytes, utf8Size } from '@/shared/lib';
import {
  Avatar,
  ButtonLink,
  Card,
  CardSkeleton,
  CodeBlock,
  CopyButton,
  ErrorNotice,
  StatusBadge,
  Tag,
  TimeAgo,
  buttonClasses,
} from '@/shared/ui';

import { type PublicSnippet, usePublicSnippet, useSnippet, useSnippetsByAuthor, useVersions } from '../api';

interface ViewModel {
  id: string;
  title: string;
  language: string;
  content: string;
  tags: string[];
  date: string | null;
  isPublic: boolean;
  author: PublicSnippet['author'];
}

export function SnippetDetail({ id, initial }: { id: string; initial?: PublicSnippet }) {
  const { isAuthenticated, profile } = useSession();
  const publicSnippet = usePublicSnippet(id, initial);
  // Pas de version publique : c'est peut-être un snippet privé de mon coffre.
  const own = useSnippet(publicSnippet.isError && isAuthenticated ? id : undefined);

  let view: ViewModel | null = null;
  if (publicSnippet.data) {
    const s = publicSnippet.data;
    view = { id: s.id, title: s.title, language: s.language, content: s.content, tags: s.tags, date: s.published_at, isPublic: true, author: s.author };
  } else if (own.data) {
    const s = own.data;
    view = {
      id: s.id,
      title: s.title,
      language: s.language,
      content: s.content,
      tags: s.tags,
      date: s.updated_at,
      isPublic: s.is_public,
      author: profile ? { id: profile.id, username: profile.username, display_name: profile.display_name || profile.username, avatar_url: profile.avatar_url, location: profile.location, stack: profile.stack?.slice(0, 3) ?? [], karma: profile.karma_score ?? 0, badges: profile.badges?.slice(0, 2) ?? [] } : null,
    };
  }

  if (!view) {
    if (publicSnippet.isPending || own.isFetching) return <CardSkeleton lines={8} />;
    return <ErrorNotice title="Snippet introuvable" message="Il est privé, a été supprimé, ou n'est pas encore disponible hors ligne." />;
  }

  const mine = Boolean(profile && view.author?.id === profile.id);
  const size = formatBytes(utf8Size(view.content));

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge dot={false}>{view.language}</StatusBadge>
          {view.isPublic ? (
            <StatusBadge tone="success">Public</StatusBadge>
          ) : (
            <StatusBadge dot={false}><Lock className="size-3" aria-hidden /> Privé</StatusBadge>
          )}
          <StatusBadge tone="success" dot={false}><WifiOff className="size-3" aria-hidden /> Consultable hors ligne après lecture</StatusBadge>
        </div>
        <h1 className="text-headline-xl text-ink">{view.title}</h1>
        {view.author ? (
          <div className="flex items-center gap-3">
            <Avatar name={view.author.display_name} src={view.author.avatar_url} size={36} />
            <div className="text-body-sm">
              <Link href={`/u/${view.author.username}`} className="font-semibold text-ink hover:underline">
                {view.author.display_name}
              </Link>{' '}
              <span className="text-body-sm text-ink-muted">@{view.author.username}</span>
              {view.date ? (
                <p className="text-label-md text-ink-faint">
                  {view.isPublic ? 'Publié' : 'Modifié'} <TimeAgo date={view.date} />
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <CopyButton
            text={view.content}
            label={`Copier le code complet (${size})`}
            className={buttonClasses({ className: 'gap-2' })}
          />
          {mine ? (
            <ButtonLink href={`/snippets/${view.id}/edit`} variant="ghost">
              <Pencil className="size-4" aria-hidden /> Modifier
            </ButtonLink>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <CodeBlock
            code={view.content}
            language={view.language}
            filename={`${view.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)}.${view.language}`}
            footer={`${view.content.split('\n').length} lignes · ${size}`}
          />
        </div>
        <aside className="space-y-4">
          {mine ? <Versions id={view.id} /> : null}
          {view.tags.length ? (
            <Card className="space-y-2 p-4">
              <h2 className="text-label-md font-bold tracking-wide uppercase text-ink-muted">Tags</h2>
              <div className="flex flex-wrap gap-1.5">
                {view.tags.map((tag) => (
                  <Tag key={tag} href={`/search?q=${encodeURIComponent(tag)}`}>{tag}</Tag>
                ))}
              </div>
            </Card>
          ) : null}
          {view.author ? <MoreFromAuthor authorId={view.author.id} currentId={view.id} name={view.author.display_name} /> : null}
          <Card className="flex gap-3 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-secondary-ink" aria-hidden />
            <p className="text-body-sm text-ink-muted">
              Une fois ouvert, ce snippet reste disponible sur cet appareil, même sans connexion.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Versions({ id }: { id: string }) {
  const versions = useVersions(id, true);
  if (!versions.data?.length) return null;
  return (
    <Card className="space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-headline-md">
        <History className="size-5 text-primary-ink" aria-hidden /> Historique des versions
      </h2>
      <ol className="space-y-2">
        {versions.data.map((version, index) => (
          <li key={version.number} className={index === 0 ? 'rounded-lg border-l-[3px] border-secondary bg-secondary-soft/30 p-2' : 'p-2'}>
            <p className="flex justify-between text-body-sm">
              <span className={index === 0 ? 'text-secondary-ink' : 'text-ink'}>v{version.number}{index === 0 ? ' (actuelle)' : ''}</span>
              <TimeAgo date={version.created_at} className="text-ink-faint" />
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function MoreFromAuthor({ authorId, currentId, name }: { authorId: string; currentId: string; name: string }) {
  const snippets = useSnippetsByAuthor(authorId);
  const others = snippets.items.filter((snippet) => snippet.id !== currentId).slice(0, 3);
  if (!others.length) return null;
  return (
    <Card className="space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-headline-md">
        <GitBranch className="size-5 text-primary-ink" aria-hidden /> Du même auteur
      </h2>
      <ul className="space-y-2">
        {others.map((snippet) => (
          <li key={snippet.id}>
            <Link href={`/snippets/${snippet.id}`} className="block rounded-lg border border-line bg-container-low p-3 hover:border-primary">
              <span className="text-label-md text-ink-muted">{snippet.language}</span>
              <span className="block text-body-sm font-medium text-ink">{snippet.title}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-label-md text-ink-faint">
        <Copy className="mr-1 inline size-3" aria-hidden />
        Snippets publics de {name}
      </p>
    </Card>
  );
}
