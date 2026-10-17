'use client';

import type { Schemas } from '@afridev/api-client';
import { Ellipsis, MessageSquare, Pencil, Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { BookmarkButton } from '@/features/bookmarks';
import { ReportButton } from '@/features/moderation';
import { useQuestion, useUpdateQuestion } from '@/features/qa';
import { errorMessage } from '@/shared/api';
import { cn, formatCount } from '@/shared/lib';
import { Menu, MenuItem, pillAction, useToast } from '@/shared/ui';

import { type HomeStats, type ReactType, shareLink, useCardVote, useDeleteCard } from '../api';

import { EditTextDialog } from './EditTextDialog';
import { InlineThread } from './InlineThread';
import { ScorePill } from './ScorePill';

type HomeItem = Schemas['HomeItem'];

const EDIT_PAGES: Partial<Record<ReactType, (id: string) => string>> = {
  snippet: (id) => `/snippets/${id}/edit`,
  project: (id) => `/projects/${id}/edit`,
  job: (id) => `/jobs/${id}?edit=1`,
};

/** Pied d'une carte du fil d'accueil : voter, commenter, partager, enregistrer, signaler, gérer. */
export function CardActions({ item }: { item: HomeItem }) {
  const card = item.card;
  if (!card) return null;
  if (item.type === 'post' || !item.stats) {
    return (
      <footer className="flex items-center gap-1 px-3 pb-3 sm:px-4">
        <ShareButton path={card.url} title={card.title} />
      </footer>
    );
  }
  return <ReactableActions item={item} type={item.type} stats={item.stats} url={card.url} title={card.title} />;
}

function ReactableActions({ item, type, stats, url, title }: { item: HomeItem; type: ReactType; stats: HomeStats; url: string; title: string }) {
  const toast = useToast();
  const vote = useCardVote(type, item.id, stats);
  const remove = useDeleteCard();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const editPage = EDIT_PAGES[type];

  return (
    <>
      <footer className="flex flex-wrap items-center gap-0.5 px-3 pb-3 sm:gap-1 sm:px-4">
        <ScorePill score={stats.score} value={stats.viewer_vote} onVote={(value) => vote.mutate(value)} loginNext={url} />
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className={cn(pillAction, open && 'bg-container text-ink')}>
          <MessageSquare className="size-4" aria-hidden /> {formatCount(stats.comment_count)}
          <span className="hidden sm:inline">{type === 'question' ? 'réponse(s)' : 'commentaire(s)'}</span>
        </button>
        <ShareButton path={url} title={title} />
        <span className="ml-auto flex items-center">
          <BookmarkButton target={{ type, id: item.id }} title={title} />
          {!stats.can_manage ? <ReportButton targetType={type} targetId={item.id} compact /> : null}
          {stats.can_manage ? (
            <Menu
              className="w-48"
              trigger={(props) => (
                <button
                  type="button"
                  aria-label="Plus d'actions"
                  {...props}
                  className="flex size-8 items-center justify-center rounded-lg text-ink-faint hover:bg-container hover:text-ink"
                >
                  <Ellipsis className="size-4" aria-hidden />
                </button>
              )}
            >
              {editPage ? (
                <MenuItem href={editPage(item.id)}>
                  <Pencil aria-hidden /> Modifier
                </MenuItem>
              ) : (
                <MenuItem onSelect={() => setEditing(true)}>
                  <Pencil aria-hidden /> Modifier
                </MenuItem>
              )}
              <MenuItem
                danger
                onSelect={() => {
                  if (!window.confirm('Supprimer ce contenu ? Cette action est définitive.')) return;
                  remove.mutate(
                    { type, id: item.id },
                    { onSuccess: () => toast('Contenu supprimé.'), onError: (error) => toast(errorMessage(error), 'error') },
                  );
                }}
              >
                <Trash2 aria-hidden /> Supprimer
              </MenuItem>
            </Menu>
          ) : null}
        </span>
      </footer>
      {open ? <InlineThread kind={type} id={item.id} href={url} /> : null}
      {editing && type === 'question' ? <EditQuestion id={item.id} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

/** La carte n'a qu'un extrait : la question complète est chargée avant d'ouvrir le formulaire. */
function EditQuestion({ id, onClose }: { id: string; onClose: () => void }) {
  const question = useQuestion(id);
  const update = useUpdateQuestion(id);
  if (!question.data) return null;
  return (
    <EditTextDialog
      title="Modifier la question"
      bodyLabel="Détails"
      minTitle={10}
      initial={{ title: question.data.title, body: question.data.body, tags: question.data.tags }}
      onSave={(content) => update.mutateAsync(content)}
      onClose={onClose}
    />
  );
}

export function ShareButton({ path, title }: { path: string; title: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        if (await shareLink(path, title)) toast('Lien copié.');
      }}
      className={cn(pillAction, 'max-sm:px-1.5')}
    >
      <Share2 className="size-4" aria-hidden /> <span className="hidden sm:inline">Partager</span>
      <span className="sr-only sm:hidden">Partager</span>
    </button>
  );
}
