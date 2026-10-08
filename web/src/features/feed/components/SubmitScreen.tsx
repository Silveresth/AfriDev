'use client';

import { postSchema } from '@afridev/validation';
import { BarChart3, Check, ImageIcon, Plus, Send, Type, Video, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';

import { HubPicker, type PickedHub, toPickedHub, useHub } from '@/features/hubs';
import { errorMessage } from '@/shared/api';
import { DraftStatus, useAutosaveDraft } from '@/shared/drafts';
import { TwoColumns } from '@/shared/layout';
import { type MediaAsset, uploadMedia } from '@/shared/media';
import { SecretAlert, useSecretScan } from '@/shared/security-guard';
import { Button, Field, Input, MarkdownEditor, SideCard, Tabs, TagInput, useToast } from '@/shared/ui';

import { type PostKind, useCreatePost } from '../api';

type Mode = 'text' | 'media' | 'poll';

interface Draft {
  mode: Mode;
  hub: PickedHub | null;
  title: string;
  body: string;
  options: string[];
  tags: string[];
}

const EMPTY: Draft = { mode: 'text', hub: null, title: '', body: '', options: ['', ''], tags: [] };

/** Brouillon enregistré avant les hubs : son ancienne « communauté » redevient un tag. */
function restore(saved: Partial<Draft> & { community?: string }): Draft {
  const { community, ...rest } = saved;
  const tags = community ? [community, ...(rest.tags ?? [])] : (rest.tags ?? []);
  return { ...EMPTY, ...rest, tags: [...new Set(tags)].slice(0, 5) };
}

/** « Créer un post » : hub (facultatif), onglets de format, titre obligatoire. */
export function SubmitScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const create = useCreatePost();
  const hubSlug = params.get('hub') ?? '';
  const presetHub = useHub(hubSlug);
  const initial: Draft = { ...EMPTY, tags: params.get('tag') ? [params.get('tag')!] : [] };
  const [draft, setDraft] = useState<Draft>(initial);
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const autosave = useAutosaveDraft<Draft>('post:submit', draft, (restored) => setDraft(restore(restored)));
  const findings = useSecretScan(draft.title, draft.body, ...draft.options);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  // Arrivée depuis la page d'un hub (?hub=<slug>) : il est proposé tant qu'aucun autre n'est choisi.
  const [hubTouched, setHubTouched] = useState(false);
  const hub = draft.hub ?? (!hubTouched && presetHub.data ? toPickedHub(presetHub.data) : null);
  const kind: PostKind = draft.mode === 'poll' ? 'poll' : draft.mode === 'media' ? (media?.kind === 'video' ? 'short' : 'image') : 'text';

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setMedia(await uploadMedia(file, file.type.startsWith('video/') ? 'video' : 'image'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    setError(null);
    if (!draft.title.trim()) {
      setError('Donnez un titre à votre post.');
      return;
    }
    const tags = draft.tags.filter(Boolean);
    const parsed = postSchema.safeParse({
      kind,
      title: draft.title,
      body: draft.body,
      pollOptions: draft.mode === 'poll' ? draft.options.filter((option) => option.trim()) : [],
      mediaId: draft.mode === 'media' ? (media?.id ?? null) : null,
      tags: [...new Set(tags)],
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Publication invalide.');
      return;
    }
    try {
      const outcome = await create.mutateAsync({
        kind: parsed.data.kind,
        title: parsed.data.title,
        body: parsed.data.body,
        poll_options: parsed.data.pollOptions,
        media_id: parsed.data.mediaId ?? null,
        tags: parsed.data.tags,
        hub_id: hub?.id ?? null,
      });
      await autosave.clear();
      toast(
        outcome.queued ? 'Hors ligne : votre post partira au retour du réseau.' : 'Post publié.',
        outcome.queued ? 'queued' : 'success',
      );
      router.push(!outcome.queued ? `/feed/${outcome.result.id}` : hub ? `/h/${hub.slug}` : '/feed');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <TwoColumns aside={<PostingRules />}>
      <h1 className="text-headline-xl text-ink">Créer un post</h1>

      <HubPicker
        value={hub}
        onChange={(picked) => {
          setHubTouched(true);
          set('hub', picked);
        }}
      />

      <Tabs<Mode>
        value={draft.mode}
        onChange={(mode) => set('mode', mode)}
        options={[
          { value: 'text', label: 'Texte', icon: <Type className="size-4" aria-hidden /> },
          { value: 'media', label: 'Images & vidéo', icon: <ImageIcon className="size-4" aria-hidden /> },
          { value: 'poll', label: 'Sondage', icon: <BarChart3 className="size-4" aria-hidden /> },
        ]}
      />

      <Field label="Titre" htmlFor="post-title" required counter={`${draft.title.length}/200`}>
        <Input
          id="post-title"
          autoFocus
          value={draft.title}
          maxLength={200}
          placeholder={draft.mode === 'poll' ? 'La question du sondage' : 'Un titre clair : le problème, l’astuce ou l’annonce'}
          onChange={(event) => set('title', event.target.value)}
          className="h-12 text-body-lg"
        />
      </Field>

      {draft.mode === 'media' ? (
        <div className="space-y-2">
          <input
            ref={fileInput}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong px-4 py-10 text-center transition-colors hover:border-primary hover:bg-container-low"
          >
            {media ? <Check className="size-7 text-secondary" aria-hidden /> : <Video className="size-7 text-ink-muted" aria-hidden />}
            <span className="font-semibold text-ink">
              {uploading
                ? 'Compression et envoi…'
                : media
                  ? media.status === 'ready'
                    ? 'Média prêt à publier'
                    : 'Média envoyé, traitement en cours (publiable maintenant)'
                  : 'Choisir une image ou une vidéo courte'}
            </span>
            <span className="text-body-sm text-ink-muted">Compressée avant l&apos;envoi pour économiser votre forfait.</span>
          </button>
          {media ? (
            <Button variant="plain" size="sm" onClick={() => setMedia(null)}>
              <X className="size-4" aria-hidden /> Retirer le média
            </Button>
          ) : null}
        </div>
      ) : null}

      {draft.mode === 'poll' ? (
        <div className="space-y-2 rounded-2xl border border-line p-4">
          <p className="text-body-sm font-semibold text-ink">Choix (2 à 4)</p>
          {draft.options.map((option, index) => (
            <div key={index} className="flex gap-2">
              <Input
                aria-label={`Choix ${index + 1}`}
                placeholder={`Choix ${index + 1}`}
                value={option}
                maxLength={80}
                onChange={(event) => {
                  const options = [...draft.options];
                  options[index] = event.target.value;
                  set('options', options);
                }}
              />
              {draft.options.length > 2 ? (
                <button
                  type="button"
                  aria-label="Retirer ce choix"
                  onClick={() => set('options', draft.options.filter((_, i) => i !== index))}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-container"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
          {draft.options.length < 4 ? (
            <Button variant="plain" size="sm" onClick={() => set('options', [...draft.options, ''])}>
              <Plus className="size-4" aria-hidden /> Ajouter un choix
            </Button>
          ) : null}
        </div>
      ) : null}

      <MarkdownEditor
        label="Texte (facultatif)"
        value={draft.body}
        onChange={(body) => set('body', body)}
        maxLength={3000}
        minHeight={draft.mode === 'text' ? 220 : 120}
        placeholder="Détaillez : contexte, code (```), ce que vous avez essayé…"
      />

      <Field label="Tags" hint="Jusqu’à 5 : langages, outils, opérateurs (wave, flutter…)">
        <TagInput value={draft.tags} max={5} onChange={(tags) => set('tags', tags)} />
      </Field>

      <SecretAlert findings={findings} />
      {error ? (
        <p role="alert" className="text-body-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <DraftStatus savedAt={autosave.savedAt} />
        <Button variant="ghost" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button
          onClick={publish}
          loading={create.isPending}
          disabled={uploading || findings.length > 0 || !draft.title.trim() || (draft.mode === 'media' && !media)}
        >
          Publier <Send className="size-4" aria-hidden />
        </Button>
      </div>
    </TwoColumns>
  );
}

/** Règles de publication (colonne de droite), comme celles d'un subreddit. */
function PostingRules() {
  const rules = [
    ['Un titre qui dit tout', 'Le problème ou l’astuce en une phrase : on doit comprendre sans ouvrir.'],
    ['Jamais de secret en clair', 'Clés d’API, jetons, mots de passe : le Security Guard bloque l’envoi.'],
    ['Du code lisible', 'Entourez-le de ``` avec le langage, et réduisez-le à l’essentiel.'],
    ['Le bon hub', 'h/python-afrique, h/mobile-money… : il aide les bonnes personnes à vous trouver.'],
    ['Bienveillance', 'Pas de moqueries sur le niveau : tout le monde a débuté.'],
  ];
  return (
    <SideCard title="Règles de publication">
      <ol className="space-y-3 px-4 pb-4">
        {rules.map(([title, text], index) => (
          <li key={title} className="flex gap-3">
            <span className="w-4 shrink-0 text-body-sm font-bold text-ink-faint tabular-nums">{index + 1}</span>
            <span>
              <span className="block text-body-sm font-semibold text-ink">{title}</span>
              <span className="block text-body-sm text-ink-muted">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </SideCard>
  );
}
