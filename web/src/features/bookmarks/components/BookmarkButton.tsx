'use client';

import { Bookmark, Check, FolderPlus, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Button, Dialog, Input, pillAction, Skeleton, useToast } from '@/shared/ui';

import { type BookmarkTarget, useCollectionActions, useCollections, useSavedMap, useToggleInCollection } from '../api';

/**
 * Bouton marque-page des cartes : ouvre « Enregistrer dans… » (choix des collections).
 * Rempli dès que le contenu figure dans au moins une collection.
 */
export function BookmarkButton({ target, title, className }: { target: BookmarkTarget; title: string; className?: string }) {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const saved = useSavedMap();
  const [open, setOpen] = useState(false);
  const isSaved = Boolean(saved.data?.get(target.id)?.length);

  return (
    <>
      <button
        type="button"
        aria-pressed={isSaved}
        aria-label={isSaved ? 'Enregistré : modifier les collections' : 'Enregistrer dans une collection'}
        title={isSaved ? 'Enregistré' : 'Enregistrer'}
        onClick={(event) => {
          event.stopPropagation();
          if (!isAuthenticated) {
            router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          setOpen(true);
        }}
        className={cn(pillAction, 'px-1.5 sm:px-2', isSaved && 'text-primary-ink hover:text-primary-ink', className)}
      >
        <Bookmark className={cn('size-4', isSaved && 'fill-current')} aria-hidden />
      </button>
      {open ? <SaveDialog target={target} title={title} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SaveDialog({ target, title, onClose }: { target: BookmarkTarget; title: string; onClose: () => void }) {
  const collections = useCollections();
  const saved = useSavedMap();
  const toggle = useToggleInCollection();
  const { create } = useCollectionActions();
  const toast = useToast();
  const [name, setName] = useState('');
  const inCollections = new Set(saved.data?.get(target.id) ?? []);

  async function flip(collectionId: string, collectionName: string) {
    const next = !inCollections.has(collectionId);
    try {
      await toggle.mutateAsync({ collectionId, target, saved: next });
      toast(next ? `Enregistré dans « ${collectionName} ».` : `Retiré de « ${collectionName} ».`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function createAndSave(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      const collection = await create.mutateAsync({ name: name.trim(), is_private: true });
      await toggle.mutateAsync({ collectionId: collection.id, target, saved: true });
      toast(`Enregistré dans « ${collection.name} ».`);
      setName('');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <Dialog open onClose={onClose} title="Enregistrer dans…">
      <p className="-mt-1 mb-3 line-clamp-2 text-body-sm text-ink-muted">{title}</p>
      {collections.isPending ? (
        <Skeleton className="h-24" />
      ) : (
        <ul className="-mx-1 max-h-72 space-y-0.5 overflow-y-auto">
          {collections.data?.map((collection) => {
            const checked = inCollections.has(collection.id);
            return (
              <li key={collection.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  disabled={toggle.isPending}
                  onClick={() => flip(collection.id, collection.name)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-container disabled:opacity-60"
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                      checked ? 'border-primary bg-primary text-on-primary' : 'border-line-strong bg-card',
                    )}
                    aria-hidden
                  >
                    {checked ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-md font-medium text-ink">{collection.name}</span>
                    <span className="block text-label-md text-ink-faint">
                      {collection.item_count} élément{collection.item_count > 1 ? 's' : ''}
                    </span>
                  </span>
                  {collection.is_private ? <Lock className="size-3.5 text-ink-faint" aria-label="Privée" /> : null}
                </button>
              </li>
            );
          })}
          {!collections.data?.length ? (
            <li className="px-2 py-3 text-body-sm text-ink-muted">Créez votre première collection ci-dessous.</li>
          ) : null}
        </ul>
      )}
      <form onSubmit={createAndSave} className="mt-3 flex gap-2 border-t border-line pt-3">
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Nouvelle collection (ex. Trucs & astuces SQL)" aria-label="Nouvelle collection" />
        <Button type="submit" variant="outline" loading={create.isPending} disabled={!name.trim()}>
          <FolderPlus className="size-4" aria-hidden /> Créer
        </Button>
      </form>
    </Dialog>
  );
}
