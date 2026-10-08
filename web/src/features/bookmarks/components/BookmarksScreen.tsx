'use client';

import { Bookmark, Code2, FolderPlus, Globe, Lock, MessagesSquare, Newspaper, Pencil, Trash2, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { clearLocalBookmarks, useBookmarks as useLocalBookmarks } from '@/shared/bookmarks';
import { PageContainer, PageHeader } from '@/shared/layout';
import { cn } from '@/shared/lib';
import { RequireAuth } from '@/shared/session';
import {
  Avatar,
  Button,
  Card,
  CardSkeleton,
  Dialog,
  EmptyState,
  Field,
  FormError,
  Input,
  Textarea,
  ToggleRow,
  TimeAgo,
  useToast,
} from '@/shared/ui';

import {
  type BookmarkItem,
  type Collection,
  useCollectionActions,
  useCollectionItems,
  useCollections,
  useQuickSave,
  useRemoveItem,
} from '../api';

const TYPES = {
  post: { label: 'Post', icon: Newspaper },
  question: { label: 'Question', icon: MessagesSquare },
  snippet: { label: 'Snippet', icon: Code2 },
};

/** /bookmarks : dossiers de marque-pages (« Mes snippets Django », « Trucs & astuces SQL »). */
export function BookmarksScreen() {
  return (
    <RequireAuth>
      <Bookmarks />
    </RequireAuth>
  );
}

function Bookmarks() {
  const collections = useCollections();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Collection | 'new' | null>(null);
  const list = collections.data ?? [];
  const current = list.find((collection) => collection.id === selected) ?? list[0] ?? null;

  return (
    <PageContainer>
      <PageHeader
        icon={<Bookmark aria-hidden />}
        title="Marque-pages"
        description="Rangez posts, questions et snippets dans des collections, privées ou partagées sur votre profil."
        actions={
          <Button onClick={() => setEditing('new')}>
            <FolderPlus className="size-4" aria-hidden /> Nouvelle collection
          </Button>
        }
      />
      <LocalImport />
      {collections.isPending ? (
        <CardSkeleton lines={3} />
      ) : !list.length ? (
        <EmptyState
          icon={<Bookmark aria-hidden />}
          title="Aucune collection"
          action={
            <Button onClick={() => setEditing('new')}>
              <FolderPlus className="size-4" aria-hidden /> Créer ma première collection
            </Button>
          }
        >
          Touchez l&apos;icône marque-page sous un post, une question ou un snippet pour l&apos;enregistrer dans une collection.
        </EmptyState>
      ) : (
        <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label="Collections" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:block md:space-y-0.5 md:px-0">
            <p className="mb-1 hidden px-3 text-label-md font-medium text-ink-faint md:block">Mes collections</p>
            {list.map((collection) => {
              const active = collection.id === current?.id;
              return (
                <button
                  key={collection.id}
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setSelected(collection.id)}
                  className={cn(
                    'flex h-9 shrink-0 items-center gap-2.5 rounded-full px-3.5 text-left text-body-sm transition-colors md:w-full',
                    active
                      ? 'bg-primary-soft font-semibold text-primary-ink'
                      : 'text-ink-muted ring-1 ring-line hover:bg-container hover:text-ink md:ring-0',
                  )}
                >
                  {collection.is_private ? <Lock className="size-3.5 shrink-0" aria-hidden /> : <Globe className="size-3.5 shrink-0" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{collection.name}</span>
                  <span className="text-label-md text-ink-faint tabular-nums">{collection.item_count}</span>
                </button>
              );
            })}
          </nav>
          {current ? <CollectionView collection={current} onEdit={() => setEditing(current)} /> : null}
        </div>
      )}
      {editing ? (
        <CollectionDialog
          collection={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={(id) => setSelected(id)}
        />
      ) : null}
    </PageContainer>
  );
}

function CollectionView({ collection, onEdit }: { collection: Collection; onEdit: () => void }) {
  const items = useCollectionItems(collection.id);
  const remove = useRemoveItem();
  const { remove: removeCollection } = useCollectionActions();
  const toast = useToast();

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-headline-md text-ink">{collection.name}</h2>
          {collection.description ? <p className="text-body-sm text-ink-muted">{collection.description}</p> : null}
          <p className="mt-1 flex items-center gap-1.5 text-label-md text-ink-faint">
            {collection.is_private ? <Lock className="size-3" aria-hidden /> : <Globe className="size-3" aria-hidden />}
            {collection.is_private ? 'Privée' : 'Publique'}, {collection.item_count} élément{collection.item_count > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" aria-hidden /> Modifier
          </Button>
          <Button
            variant="plain"
            size="sm"
            onClick={() => {
              if (!window.confirm(`Supprimer « ${collection.name} » et ses marque-pages ?`)) return;
              removeCollection.mutate(collection.id, { onSuccess: () => toast('Collection supprimée.') });
            }}
            aria-label="Supprimer la collection"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      {items.isPending ? (
        <CardSkeleton lines={2} />
      ) : !items.items.length ? (
        <EmptyState icon={<Bookmark aria-hidden />} title="Collection vide">
          Enregistrez un contenu ici depuis son bouton marque-page.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {items.items.map((item) => (
            <ItemRow key={item.id} item={item} onRemove={() => remove.mutate(item.id)} />
          ))}
        </Card>
      )}
      {items.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => items.fetchNextPage()} loading={items.isFetchingNextPage}>
          Charger plus
        </Button>
      ) : null}
    </section>
  );
}

function ItemRow({ item, onRemove }: { item: BookmarkItem; onRemove: () => void }) {
  const type = TYPES[item.target_type];
  const target = item.target;
  return (
    <div className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-container-low">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-container-low text-ink-muted">
        <type.icon className="size-4" aria-hidden />
      </span>
      {target ? (
        <Link href={target.href} className="min-w-0 flex-1">
          <span className="block truncate text-body-md font-medium text-ink group-hover:text-primary-ink">{target.title}</span>
          {target.excerpt ? <span className="line-clamp-1 text-body-sm text-ink-muted">{target.excerpt}</span> : null}
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-label-md text-ink-faint">
            {type.label}
            {target.language ? ` · ${target.language}` : ''}
            {target.author ? (
              <>
                <span aria-hidden>·</span>
                <Avatar name={target.author.display_name} src={target.author.avatar_url} size={14} />
                {target.author.display_name}
              </>
            ) : null}
            <span aria-hidden>·</span> enregistré <TimeAgo date={item.saved_at} />
          </span>
        </Link>
      ) : (
        <span className="min-w-0 flex-1 text-body-sm text-ink-faint italic">
          {type.label} supprimé ou redevenu privé.
        </span>
      )}
      <button
        type="button"
        aria-label="Retirer de la collection"
        onClick={onRemove}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-container hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function CollectionDialog({
  collection,
  onClose,
  onCreated,
}: {
  collection: Collection | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { create, update } = useCollectionActions();
  const toast = useToast();
  const [form, setForm] = useState({
    name: collection?.name ?? '',
    description: collection?.description ?? '',
    is_private: collection?.is_private ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (collection) {
        await update.mutateAsync({ id: collection.id, ...form });
        toast('Collection mise à jour.');
      } else {
        const created = await create.mutateAsync(form);
        onCreated(created.id);
        toast(`Collection « ${created.name} » créée.`);
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Dialog open onClose={onClose} title={collection ? 'Modifier la collection' : 'Nouvelle collection'}>
      <p className="-mt-1 mb-5 text-body-sm text-ink-muted">Regroupez des contenus par thème, pour les retrouver en un clic.</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom" htmlFor="collection-name" required>
          <Input id="collection-name" autoFocus required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mes snippets Django" />
        </Field>
        <Field label="Description" htmlFor="collection-description">
          <Textarea id="collection-description" maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-16" />
        </Field>
        <ToggleRow
          icon={<Lock aria-hidden />}
          title="Collection privée"
          description="Sinon, elle est visible par les autres membres sur votre profil."
          checked={form.is_private}
          onChange={(is_private) => setForm({ ...form, is_private })}
        />
        {error ? <FormError>{error}</FormError> : null}
        <div className="-mx-5 -mb-5 flex justify-end gap-2 rounded-b-2xl border-t border-line bg-container-low/60 px-5 py-4">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {collection ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Marque-pages enregistrés sur l'appareil avant les collections : import en un clic. */
function LocalImport() {
  const local = useLocalBookmarks();
  const quickSave = useQuickSave();
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  if (!local.length) return null;

  async function importAll() {
    setImporting(true);
    let done = 0;
    for (const entry of local) {
      try {
        await quickSave.mutateAsync({ type: entry.type, id: entry.id });
        done += 1;
      } catch {
        // contenu supprimé depuis : ignoré
      }
    }
    clearLocalBookmarks();
    setImporting(false);
    toast(`${done} marque-page${done > 1 ? 's' : ''} importé${done > 1 ? 's' : ''} dans « Favoris ».`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary-soft/60 px-4 py-3">
      <Upload className="size-4 text-primary-ink" aria-hidden />
      <p className="min-w-0 flex-1 text-body-sm text-ink">
        {local.length} marque-page{local.length > 1 ? 's' : ''} enregistré{local.length > 1 ? 's' : ''} sur cet appareil.
      </p>
      <Button size="sm" onClick={importAll} loading={importing}>
        Importer dans mes collections
      </Button>
    </div>
  );
}
