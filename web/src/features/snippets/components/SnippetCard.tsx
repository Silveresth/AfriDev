'use client';

import type { Schemas } from '@afridev/api-client';
import Link from 'next/link';

import { BookmarkButton } from '@/features/bookmarks';
import { cn, formatBytes, utf8Size } from '@/shared/lib';
import { AuthorBadges, Avatar, CodeBlock, HubLink, KarmaPill, Tag, TimeAgo } from '@/shared/ui';

type Author = Schemas['Author'];
type HubSummary = Schemas['HubSummary'];

export interface SnippetCardData {
  id: string;
  title: string;
  language: string;
  content: string;
  tags: string[];
  /** Date affichée : publication (snippet public) ou dernière modification (coffre). */
  date: string;
  dateLabel?: string;
  author?: Author | null;
  hub?: HubSummary | null;
}

/**
 * Carte de snippet : titre, auteur, aperçu du code dans un bloc sombre coloré (numéros de ligne,
 * langage, « Copier le code » en un clic qui copie le snippet complet), tags et métadonnées.
 * `badges`, `actions`, `banner` et `footer` accueillent ce qui est propre au contexte (coffre, profil).
 */
export function SnippetCard({
  snippet,
  previewLines = 8,
  badges,
  actions,
  banner,
  footer,
  bookmark = true,
  className,
}: {
  snippet: SnippetCardData;
  previewLines?: number;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  banner?: React.ReactNode;
  footer?: React.ReactNode;
  bookmark?: boolean;
  className?: string;
}) {
  const href = `/snippets/${snippet.id}`;
  const lines = snippet.content.split('\n');
  const preview = lines.slice(0, previewLines).join('\n');
  const hidden = lines.length - previewLines;
  const author = snippet.author;
  const name = author?.display_name || author?.username;

  return (
    <article className={cn('group rounded-2xl border border-line bg-card shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raised', className)}>
      <div className="space-y-3 p-4 sm:p-5">
        {banner}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            {badges ? <div className="flex flex-wrap gap-1.5">{badges}</div> : null}
            <h2 className="text-headline-md text-ink">
              <Link href={href} className="transition-colors hover:text-primary-ink">
                {snippet.title}
              </Link>
            </h2>
            {author && name ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-md text-ink-faint">
                <Link href={`/u/${author.username}`} className="flex items-center gap-1.5 text-body-sm font-medium text-ink hover:underline">
                  <Avatar name={name} src={author.avatar_url} size={20} />
                  {name}
                </Link>
                <AuthorBadges location={author.location} stack={author.stack} />
                {author.karma ? <KarmaPill karma={author.karma} /> : null}
                <span aria-hidden>·</span>
                <TimeAgo date={snippet.date} />
                {snippet.hub ? (
                  <>
                    <span aria-hidden>·</span>
                    <HubLink hub={snippet.hub} />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
        </header>
        <CodeBlock
          code={preview}
          copyText={snippet.content}
          language={snippet.language}
          maxHeight={previewLines * 22 + 24}
          footer={
            hidden > 0 ? (
              <Link href={href} className="hover:text-code-ink">
                + {hidden} ligne{hidden > 1 ? 's' : ''} · voir le snippet complet →
              </Link>
            ) : undefined
          }
        />
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5 sm:px-5">
        <div className="-ml-1.5 flex min-w-0 flex-1 flex-wrap gap-0.5">
          {snippet.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
        <span className="text-label-md text-ink-faint">
          {author ? null : (
            <>
              {snippet.dateLabel ?? 'Mis à jour'} <TimeAgo date={snippet.date} /> ·{' '}
            </>
          )}
          {formatBytes(utf8Size(snippet.content))}
        </span>
        {footer}
        {bookmark ? <BookmarkButton target={{ type: 'snippet', id: snippet.id }} title={snippet.title} /> : null}
      </footer>
    </article>
  );
}
