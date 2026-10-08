'use client';

import { questionSchema } from '@afridev/validation';
import { ArrowLeft, CheckCircle2, Lightbulb, Lock, MessagesSquare, Save, Send, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { HubPicker, type PickedHub, toPickedHub, useHub } from '@/features/hubs';
import { errorMessage } from '@/shared/api';
import { DraftStatus, useAutosaveDraft } from '@/shared/drafts';
import { useDebounced } from '@/shared/hooks';
import { PageContainer, PageHeader } from '@/shared/layout';
import { redactSecrets, SecretAlert, useSecretScan } from '@/shared/security-guard';
import {
  Button,
  Field,
  FormCard,
  FormError,
  FormFooter,
  FormSection,
  Input,
  MarkdownEditor,
  Spinner,
  TagInput,
  TipCard,
  useToast,
} from '@/shared/ui';

import { askQuestion, rephraseQuestion, useSimilarQuestions } from '../api';
import { VoiceButton } from './VoiceButton';

interface Draft {
  title: string;
  body: string;
  tags: string[];
}

const EMPTY: Draft = { title: '', body: '', tags: [] };
const TAG_SUGGESTIONS = ['mobile-money', 'ussd', 'django', 'react-native', 'flutter', 'offline-first'];

export function AskQuestionScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  // undefined = pas encore choisi : le hub de la page d'origine (?hub=) est proposé par défaut.
  const [hubChoice, setHub] = useState<PickedHub | null>();
  const presetHub = useHub(params.get('hub') ?? '');
  const hub = hubChoice !== undefined ? hubChoice : presetHub.data ? toPickedHub(presetHub.data) : null;
  const [audioId, setAudioId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ title: string; body: string } | null>(null);
  const [rephrasing, setRephrasing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autosave = useAutosaveDraft<Draft>('question:new', draft, setDraft);
  const findings = useSecretScan(draft.title, draft.body);
  const locked = findings.length > 0;
  const similar = useSimilarQuestions(useDebounced(`${draft.title} ${draft.body}`.trim(), 800));

  async function rephrase() {
    setError(null);
    setRephrasing(true);
    try {
      setSuggestion(await rephraseQuestion(draft.title, draft.body));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRephrasing(false);
    }
  }

  async function publish() {
    setError(null);
    const parsed = questionSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Question incomplète.');
      return;
    }
    setPublishing(true);
    try {
      const outcome = await askQuestion({ ...parsed.data, audio_media_id: audioId, hub_id: hub?.id ?? null });
      await autosave.clear();
      if (outcome.queued) {
        toast('Hors ligne : votre question partira au retour du réseau.', 'queued');
        router.push('/questions');
      } else {
        router.push(`/questions/${outcome.result.id}`);
      }
    } catch (e) {
      setError(errorMessage(e));
      setPublishing(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<MessagesSquare aria-hidden />}
        eyebrow={
          <Link href="/questions" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="size-3.5" aria-hidden /> Q&amp;A
          </Link>
        }
        title="Poser une question"
        description="Une première réponse de l'IA en quelques secondes, puis celle de la communauté."
        actions={<DraftStatus savedAt={autosave.savedAt} />}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <FormCard>
          <FormSection title="Votre blocage" description="Un titre précis attire les bonnes personnes ; les détails leur permettent de répondre.">
            <Field
              label="Titre"
              required
              hint="Résumez le problème, l'environnement et le service concerné."
              counter={`${draft.title.length} / 200`}
              htmlFor="title"
            >
              <Input
                id="title"
                value={draft.title}
                maxLength={200}
                placeholder="Ex. Comment sécuriser un webhook T-Money avec FastAPI ?"
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </Field>

            <Field label="Détails" required hint="Contexte, ce que vous avez essayé, message d'erreur. Le code va dans un bloc ```." htmlFor="body">
              <MarkdownEditor
                id="body"
                value={draft.body}
                maxLength={10000}
                invalid={locked}
                placeholder="Décrivez votre problème…"
                onChange={(body) => setDraft({ ...draft, body })}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <VoiceButton
                onTranscript={(text, mediaId) => {
                  setAudioId(mediaId);
                  setDraft((current) => ({ ...current, body: current.body ? `${current.body}\n\n${text}` : text }));
                }}
              />
              <Button variant="outline" onClick={rephrase} loading={rephrasing} disabled={!draft.title.trim() || !draft.body.trim() || locked}>
                <Sparkles className="size-4 text-primary" aria-hidden /> Améliorer avec l&apos;IA
              </Button>
            </div>

            {suggestion ? (
              <div className="space-y-3 rounded-xl border border-primary/25 bg-primary-soft/40 p-4">
                <p className="flex items-center gap-2 text-body-sm font-semibold text-primary-ink">
                  <Lightbulb className="size-4" aria-hidden /> Reformulation proposée par l&apos;IA
                </p>
                <div className="space-y-1 rounded-lg border border-line bg-card p-3">
                  <p className="font-semibold text-ink">{suggestion.title}</p>
                  <p className="line-clamp-4 whitespace-pre-wrap text-body-sm text-ink-muted">{suggestion.body}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setDraft({ ...draft, title: suggestion.title, body: suggestion.body });
                      setSuggestion(null);
                    }}
                  >
                    <CheckCircle2 className="size-4" aria-hidden /> Utiliser cette version
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSuggestion(null)}>
                    Garder la mienne
                  </Button>
                </div>
              </div>
            ) : null}

            <SecretAlert
              findings={findings}
              onRedact={() => setDraft({ ...draft, title: redactSecrets(draft.title), body: redactSecrets(draft.body) })}
            />
          </FormSection>

          <FormSection title="Classement" description="Aide la question à arriver devant les bons experts.">
            <Field label="Tags techniques" hint="Jusqu'à 5 tags." htmlFor="tags">
              <TagInput id="tags" value={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} suggestions={TAG_SUGGESTIONS} />
            </Field>
            <Field label="Hub" hint="Facultatif : la communauté qui verra votre question en premier.">
              <HubPicker value={hub} onChange={setHub} />
            </Field>
            {error ? <FormError>{error}</FormError> : null}
          </FormSection>

          <FormFooter
            start={
              <span className="inline-flex items-center gap-2">
                <Save className="size-4" aria-hidden /> Brouillon gardé sur cet appareil
              </span>
            }
          >
            <Button variant="ghost" onClick={() => router.back()}>
              Annuler
            </Button>
            <Button onClick={publish} loading={publishing} disabled={locked}>
              {locked ? <Lock className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {locked ? 'Publication verrouillée' : 'Publier la question'}
            </Button>
          </FormFooter>
        </FormCard>

        <aside className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
            <h2 className="flex items-center justify-between gap-2 text-body-sm font-semibold text-ink">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-secondary-ink" aria-hidden /> Déjà résolu ?
              </span>
              {similar.isFetching ? <Spinner className="size-4 text-ink-faint" /> : null}
            </h2>
            {similar.data?.length ? (
              <ul className="space-y-2">
                {similar.data.map((hit) => (
                  <li key={hit.source_id}>
                    <Link
                      href={hit.url}
                      className="block rounded-xl border border-line bg-container-low/60 px-3 py-2.5 text-body-sm font-medium text-ink transition-colors hover:border-primary/40 hover:bg-card"
                    >
                      {hit.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-ink-muted">
                {draft.title.length < 15
                  ? 'Les questions similaires déjà résolues apparaîtront ici pendant que vous écrivez.'
                  : 'Aucune question similaire trouvée.'}
              </p>
            )}
          </section>
          <TipCard tone="primary" icon={<Zap aria-hidden />} title="Pour une réponse rapide">
            <p>Donnez le code minimal qui reproduit le problème, et le message d&apos;erreur exact.</p>
            <p>Masquez vos identifiants réels : utilisez ceux de test (sandbox Flooz, T-Money, Wave).</p>
          </TipCard>
        </aside>
      </div>
    </PageContainer>
  );
}
