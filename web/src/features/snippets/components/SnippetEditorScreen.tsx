'use client';

import { snippetSchema } from '@afridev/validation';
import { ArrowLeft, Code2, Globe, Lock, Save, ShieldCheck, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { HubPicker, type PickedHub } from '@/features/hubs';
import { errorMessage } from '@/shared/api';
import { DraftStatus, useAutosaveDraft } from '@/shared/drafts';
import { PageContainer, PageHeader } from '@/shared/layout';
import { formatBytes, utf8Size } from '@/shared/lib';
import { redactSecrets, SecretAlert, useSecretScan } from '@/shared/security-guard';
import {
  Button,
  CardSkeleton,
  CodeEditor,
  Field,
  FormCard,
  FormError,
  FormFooter,
  FormSection,
  Input,
  Select,
  TagInput,
  TipCard,
  ToggleRow,
  useToast,
} from '@/shared/ui';

import { LANGUAGES, type SnippetInput, useSaveSnippet, useSnippet } from '../api';

const EMPTY: SnippetInput = { title: '', language: 'python', content: '', tags: [], is_public: false };

/** Création et modification d'un snippet (Security Guard en direct, brouillon automatique). */
export function SnippetEditorScreen({ id }: { id?: string }) {
  const existing = useSnippet(id);
  if (id && !existing.data) return existing.isError ? <p>Snippet introuvable.</p> : <CardSkeleton lines={8} />;
  return <Editor id={id} initial={existing.data ?? undefined} />;
}

function Editor({ id, initial }: { id?: string; initial?: SnippetInput & { id: string } }) {
  const router = useRouter();
  const toast = useToast();
  const save = useSaveSnippet();
  const [form, setForm] = useState<SnippetInput>(
    initial
      ? { title: initial.title, language: initial.language, content: initial.content, tags: initial.tags, is_public: initial.is_public }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [hub, setHub] = useState<PickedHub | null>(null);
  // Brouillon automatique seulement pour un nouveau snippet (la version serveur fait foi sinon).
  const autosave = useAutosaveDraft<SnippetInput>(id ? `snippet:${id}` : 'snippet:new', form, id ? undefined : setForm);
  const findings = useSecretScan(form.content, form.title);
  const flaggedLines = findings.map((finding) => finding.line);

  async function submit() {
    setError(null);
    const parsed = snippetSchema.safeParse({
      title: form.title,
      language: form.language,
      content: form.content,
      tags: form.tags,
      isPublic: form.is_public,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Snippet invalide.');
      return;
    }
    try {
      const outcome = await save.mutateAsync({ id, input: hub ? { ...form, hub_id: hub.id } : form });
      await autosave.clear();
      if (outcome.queued) toast('Hors ligne : enregistré, envoi au retour du réseau.', 'queued');
      else toast('Snippet enregistré.');
      router.push(outcome.queued ? '/snippets' : `/snippets/${outcome.result.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const locked = findings.length > 0;

  return (
    <PageContainer>
      <PageHeader
        icon={<Code2 aria-hidden />}
        eyebrow={
          <Link href="/snippets" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="size-3.5" aria-hidden /> Snippets
          </Link>
        }
        title={id ? 'Modifier le snippet' : 'Nouveau snippet'}
        description="Rangé dans votre coffre et disponible hors ligne, privé tant que vous ne le publiez pas."
        actions={<DraftStatus savedAt={autosave.savedAt} />}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <FormCard>
          <FormSection title="Le code">
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Field label="Titre" required htmlFor="snippet-title" counter={`${form.title.length} / 120`}>
                <Input
                  id="snippet-title"
                  value={form.title}
                  maxLength={120}
                  placeholder="Ex. Vérification de signature webhook Wave"
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </Field>
              <Field label="Langage" htmlFor="snippet-language">
                <Select id="snippet-language" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}>
                  {LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Code" required htmlFor="snippet-code" counter={formatBytes(utf8Size(form.content))}>
              <CodeEditor
                id="snippet-code"
                label="Code"
                value={form.content}
                onChange={(content) => setForm({ ...form, content })}
                flaggedLines={flaggedLines}
                placeholder="# Collez votre code ici"
                minRows={14}
              />
            </Field>
            <SecretAlert
              findings={findings}
              onRedact={() => setForm({ ...form, content: redactSecrets(form.content), title: redactSecrets(form.title) })}
            />
            <Field label="Tags" htmlFor="snippet-tags" hint="Langage, framework, domaine (jusqu'à 8).">
              <TagInput
                id="snippet-tags"
                value={form.tags}
                max={8}
                onChange={(tags) => setForm({ ...form, tags })}
                suggestions={['wave', 'orange-money', 'ussd', 'docker', 'postgresql']}
              />
            </Field>
          </FormSection>

          <FormSection title="Partage" description="Un snippet reste privé par défaut : vous seul le voyez.">
            {!id ? (
              <ToggleRow
                icon={<Globe aria-hidden />}
                title="Publier dans la communauté"
                description="Visible par tous et ajouté à la base de connaissances de l'IA. Une seconde analyse le repasse en privé s'il expose une donnée sensible."
                checked={form.is_public}
                onChange={(is_public) => setForm({ ...form, is_public })}
              />
            ) : null}
            {form.is_public || id ? (
              <Field
                label="Hub"
                hint={id ? 'Choisissez un hub pour y déplacer le snippet (inchangé sinon).' : 'Facultatif : le hub où le snippet sera partagé.'}
              >
                <HubPicker value={hub} onChange={setHub} />
              </Field>
            ) : null}
            {error ? <FormError>{error}</FormError> : null}
          </FormSection>

          <FormFooter
            start={
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-secondary-ink" aria-hidden /> Security Guard vérifie le code pendant la saisie
              </span>
            }
          >
            <Button variant="ghost" onClick={() => router.back()}>
              Annuler
            </Button>
            <Button onClick={submit} loading={save.isPending} disabled={locked}>
              {locked ? <Lock className="size-4" aria-hidden /> : <Save className="size-4" aria-hidden />}
              {locked ? 'Enregistrement verrouillé' : 'Enregistrer'}
            </Button>
          </FormFooter>
        </FormCard>

        <aside className="space-y-4">
          <TipCard icon={<ShieldCheck className="text-secondary-ink" aria-hidden />} title="Security Guard">
            <p>
              Clés d&apos;API, mots de passe et jetons sont repérés ligne par ligne, directement sur l&apos;appareil.
              L&apos;enregistrement est bloqué tant qu&apos;un secret reste dans le code.
            </p>
          </TipCard>
          <TipCard icon={<WifiOff aria-hidden />} title="Disponible hors ligne">
            <p>Le snippet est gardé dans votre coffre local : consultable et modifiable sans réseau, synchronisé au retour.</p>
          </TipCard>
        </aside>
      </div>
    </PageContainer>
  );
}
