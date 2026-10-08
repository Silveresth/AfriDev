'use client';

import { answerSchema } from '@afridev/validation';
import { ArrowBigDown, ArrowBigUp, ArrowLeft, CheckCircle2, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BookmarkButton } from '@/features/bookmarks';
import { ReportButton } from '@/features/moderation';
import { TranslateButton } from '@/features/translation';
import { errorMessage } from '@/shared/api';
import { DraftStatus, useAutosaveDraft } from '@/shared/drafts';
import { TwoColumns } from '@/shared/layout';
import { cn } from '@/shared/lib';
import { useOutbox } from '@/shared/offline';
import { SecretAlert, useSecretScan } from '@/shared/security-guard';
import { useSession } from '@/shared/session';
import {
  AuthorBadges,
  Avatar,
  Button,
  ButtonLink,
  Card,
  CardSkeleton,
  CommunityIcon,
  ErrorNotice,
  HubLink,
  Markdown,
  MarkdownEditor,
  pillAction,
  Reputation,
  Segmented,
  Skeleton,
  StatusBadge,
  Tag,
  TimeAgo,
  useToast,
} from '@/shared/ui';

import {
  type Answer,
  type Question,
  useAnswerActions,
  useAnswers,
  useCreateAnswer,
  useDeleteQuestion,
  useQuestion,
  useRegenerateAiAnswer,
} from '../api';

export function QuestionDetail({ id, initial, aside }: { id: string; initial?: Question; aside?: React.ReactNode }) {
  const question = useQuestion(id, initial);
  return (
    <TwoColumns aside={aside}>
      <Link
        href="/questions"
        className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-line bg-card px-3 text-body-sm font-medium text-ink-muted shadow-card hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Q&amp;A
      </Link>
      {question.data ? (
        <QuestionView question={question.data} />
      ) : question.isError ? (
        <ErrorNotice title="Question introuvable" message="Elle a peut-être été supprimée, ou n'est pas encore disponible hors ligne." />
      ) : (
        <CardSkeleton lines={6} />
      )}
    </TwoColumns>
  );
}

function QuestionView({ question }: { question: Question }) {
  const { user } = useSession();
  const router = useRouter();
  const remove = useDeleteQuestion();
  const mine = Boolean(user && question.author?.id === user.id);
  const name = question.author?.display_name || question.author?.username || 'Membre';
  const [community, ...tags] = question.tags;

  return (
    <>
      <article className="rounded-2xl border border-line bg-card px-4 pt-4 pb-2.5 shadow-card sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-body-sm">
          {community ? (
            <Link href={`/questions?tag=${encodeURIComponent(community)}`} className="flex items-center gap-1.5 font-bold text-ink hover:underline">
              <CommunityIcon tag={community} size={20} /> d/{community}
            </Link>
          ) : null}
          {community ? <span className="text-ink-faint" aria-hidden>•</span> : null}
          <span className="flex items-center gap-1.5 text-ink-muted">
            <Avatar name={name} src={question.author?.avatar_url} size={20} />
            {question.author ? (
              <Link href={`/u/${question.author.username}`} className="font-medium hover:text-ink">
                {name}
              </Link>
            ) : (
              name
            )}
          </span>
          <AuthorBadges location={question.author?.location} stack={question.author?.stack} />
          <Reputation karma={question.author?.karma} badges={question.author?.badges} />
          {question.hub ? (
            <>
              <span className="text-ink-faint" aria-hidden>•</span>
              <HubLink hub={question.hub} />
            </>
          ) : null}
          <span className="text-ink-faint" aria-hidden>•</span>
          <TimeAgo date={question.created_at} className="text-ink-faint" />
          <span className="ml-auto">
            {question.is_resolved ? (
              <StatusBadge tone="success" dot={false}>
                <CheckCircle2 className="size-3.5" aria-hidden /> Résolu
              </StatusBadge>
            ) : (
              <StatusBadge tone="warning">En attente</StatusBadge>
            )}
          </span>
        </div>
        <h1 className="mt-2 text-headline-xl text-ink">{question.title}</h1>
        <div className="mt-3 text-body-lg">
          <Markdown source={question.body} />
        </div>
        {tags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Tag key={tag} href={`/questions?tag=${encodeURIComponent(tag)}`}>
                {tag}
              </Tag>
            ))}
          </div>
        ) : null}
        <div className="-mx-2 mt-3 flex flex-wrap items-center gap-1">
          <span className={cn(pillAction, 'hover:bg-transparent')}>
            {question.answer_count} réponse{question.answer_count > 1 ? 's' : ''}
          </span>
          <BookmarkButton target={{ type: 'question', id: question.id }} title={question.title} />
          <TranslateButton text={`${question.title}\n\n${question.body}`} />
          <span className="ml-auto">
            {mine ? (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('Supprimer cette question ?')) return;
                  await remove.mutateAsync(question.id);
                  router.push('/questions');
                }}
                className={cn(pillAction, 'hover:text-danger')}
              >
                <Trash2 className="size-4" aria-hidden /> Supprimer
              </button>
            ) : (
              <ReportButton targetType="question" targetId={question.id} compact />
            )}
          </span>
        </div>
      </article>

      <AiAnswer question={question} mine={mine} />
      <CommunityAnswers question={question} mine={mine} />
    </>
  );
}

const AI_STATUS = {
  ready: { label: 'Générée', tone: 'success' },
  pending: { label: 'Rédaction…', tone: 'warning' },
  failed: { label: 'Échec', tone: 'danger' },
  disabled: { label: 'Indisponible', tone: 'neutral' },
} as const;

function AiAnswer({ question, mine }: { question: Question; mine: boolean }) {
  const regenerate = useRegenerateAiAnswer(question.id);
  const status = question.ai_answer_status;
  const sources = question.ai_answer_sources;

  return (
    <section aria-labelledby="ai-answer" className="overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-primary-soft/50 px-4 py-3 sm:px-6">
        <h2 id="ai-answer" className="flex items-center gap-2.5 text-headline-md text-ink">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-on-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          Première réponse de l&apos;IA
        </h2>
        <StatusBadge tone={AI_STATUS[status].tone}>{AI_STATUS[status].label}</StatusBadge>
      </header>
      <div className="space-y-4 px-4 py-4 sm:px-6">
        {status === 'pending' ? (
          <div className="space-y-2" role="status" aria-label="L'IA rédige une réponse">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : status === 'ready' && question.ai_answer ? (
          <Markdown source={question.ai_answer} citeHref={(n) => (sources[n - 1] ? `#source-${n}` : undefined)} />
        ) : status === 'disabled' ? (
          <p className="text-body-md text-ink-muted">L&apos;assistant IA n&apos;est pas activé sur ce serveur.</p>
        ) : (
          <p className="text-body-md text-ink-muted">L&apos;IA n&apos;a pas pu répondre cette fois-ci.</p>
        )}
        {status === 'ready' && sources.length ? (
          <div className="space-y-2 rounded-xl bg-container-low p-3">
            <p className="text-label-md font-bold text-ink-muted uppercase">Sources de la communauté</p>
            <ol className="space-y-1">
              {sources.map((source, index) => (
                <li key={source.source_id} id={`source-${index + 1}`} className="text-body-sm">
                  <Link href={source.url} className="text-primary-ink hover:underline">
                    [{index + 1}] {source.title}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-body-sm text-ink-faint">En attendant la communauté. Vérifiez toujours avant de mettre en production.</p>
          {mine && (status === 'failed' || status === 'ready') ? (
            <Button variant="ghost" size="sm" onClick={() => regenerate.mutate()} loading={regenerate.isPending}>
              <RefreshCw className="size-4" aria-hidden /> Régénérer
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CommunityAnswers({ question, mine }: { question: Question; mine: boolean }) {
  const answers = useAnswers(question.id);
  const [sort, setSort] = useState<'votes' | 'recent'>('votes');
  const pending = useOutbox('answers').filter((entry) => entry.data.question_id === question.id);
  const sorted = [...(answers.data ?? [])].sort((a, b) =>
    sort === 'recent' ? b.created_at.localeCompare(a.created_at) : Number(b.is_accepted) - Number(a.is_accepted) || b.score - a.score,
  );
  const count = answers.data?.length ?? question.answer_count;

  return (
    <section aria-labelledby="answers" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 id="answers" className="text-headline-lg text-ink">
          {count} réponse{count > 1 ? 's' : ''} de la communauté
        </h2>
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: 'votes', label: 'Meilleures' },
            { value: 'recent', label: 'Récentes' },
          ]}
        />
      </div>
      {answers.isPending ? <CardSkeleton /> : null}
      {sorted.map((answer) => (
        <AnswerCard key={answer.id} answer={answer} questionId={question.id} canAccept={mine} />
      ))}
      {pending.map((entry) => (
        <Card key={entry.id} className="space-y-2 border-dashed p-4">
          <StatusBadge tone="offline">En attente de réseau</StatusBadge>
          <p className="whitespace-pre-wrap text-body-md text-ink">{String(entry.data.body)}</p>
        </Card>
      ))}
      <AnswerForm questionId={question.id} />
    </section>
  );
}

function AnswerCard({ answer, questionId, canAccept }: { answer: Answer; questionId: string; canAccept: boolean }) {
  const { user, isAuthenticated } = useSession();
  const { accept, vote, remove } = useAnswerActions(questionId);
  const mine = Boolean(user && answer.author?.id === user.id);
  const name = answer.author?.display_name || answer.author?.username || 'Membre';
  const canVote = isAuthenticated && !mine;

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border bg-card shadow-card',
        answer.is_accepted ? 'border-secondary/60 ring-3 ring-secondary/10' : 'border-line',
      )}
    >
      {answer.is_accepted ? (
        <p className="flex items-center gap-2 border-b border-secondary/25 bg-secondary-soft px-4 py-2 text-body-sm font-medium text-on-secondary-soft sm:px-5">
          <CheckCircle2 className="size-4" aria-hidden /> Solution acceptée par l&apos;auteur de la question
        </p>
      ) : null}
      <div className="flex gap-3 p-4 sm:gap-4 sm:px-5">
        <div
          className={cn(
            'flex shrink-0 flex-col items-center self-start rounded-lg border p-0.5',
            answer.is_accepted ? 'border-secondary/30 bg-secondary-soft/60' : 'border-line bg-container-low',
          )}
        >
          <button
            type="button"
            aria-label="Voter pour"
            disabled={!canVote}
            onClick={() => vote.mutate({ answerId: answer.id, value: 1 })}
            className="flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-primary-soft hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ArrowBigUp className="size-5" aria-hidden />
          </button>
          <span className="py-0.5 text-body-sm font-semibold text-ink tabular-nums">{answer.score}</span>
          <button
            type="button"
            aria-label="Voter contre"
            disabled={!canVote}
            onClick={() => vote.mutate({ answerId: answer.id, value: -1 })}
            className="flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-downvote-soft hover:text-downvote disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ArrowBigDown className="size-5" aria-hidden />
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-body-sm">
            <Avatar name={name} src={answer.author?.avatar_url} size={24} />
            {answer.author ? (
              <Link href={`/u/${answer.author.username}`} className="font-semibold text-ink hover:underline">
                {name}
              </Link>
            ) : (
              <span className="font-semibold">{name}</span>
            )}
            <span className="text-ink-faint" aria-hidden>•</span>
            <TimeAgo date={answer.created_at} className="text-ink-faint" />
            <AuthorBadges location={answer.author?.location} stack={answer.author?.stack} />
          <Reputation karma={answer.author?.karma} badges={answer.author?.badges} />
          </div>
          <Markdown source={answer.body} />
          <div className="-ml-2 flex flex-wrap items-center gap-1">
            {canAccept && !answer.is_accepted ? (
              <Button variant="secondary" size="sm" onClick={() => accept.mutate(answer.id)} loading={accept.isPending}>
                <CheckCircle2 className="size-4" aria-hidden /> Accepter comme solution
              </Button>
            ) : null}
            <TranslateButton text={answer.body} />
            <span className="ml-auto">
              {mine ? (
                <button
                  type="button"
                  onClick={() => window.confirm('Supprimer votre réponse ?') && remove.mutate(answer.id)}
                  className={cn(pillAction, 'hover:text-danger')}
                >
                  <Trash2 className="size-4" aria-hidden /> Supprimer
                </button>
              ) : (
                <ReportButton targetType="answer" targetId={answer.id} compact />
              )}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function AnswerForm({ questionId }: { questionId: string }) {
  const { isAuthenticated, profile } = useSession();
  const toast = useToast();
  const create = useCreateAnswer(questionId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const autosave = useAutosaveDraft(`answer:${questionId}`, body, setBody);
  const findings = useSecretScan(body);

  if (!isAuthenticated) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-body-md text-ink">Vous connaissez la solution ? Connectez-vous pour répondre.</p>
        <ButtonLink href={`/login?next=/questions/${questionId}`} size="sm">
          Se connecter
        </ButtonLink>
      </Card>
    );
  }

  async function submit() {
    setError(null);
    const parsed = answerSchema.safeParse({ body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Réponse invalide.');
      return;
    }
    try {
      const outcome = await create.mutateAsync(parsed.data.body);
      setBody('');
      await autosave.clear();
      toast(outcome.queued ? 'Hors ligne : réponse envoyée au retour du réseau.' : 'Réponse publiée.', outcome.queued ? 'queued' : 'success');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Card className="space-y-3 p-4 sm:px-5">
      <div className="flex items-center gap-3">
        <Avatar name={profile?.display_name || profile?.username || '?'} src={profile?.avatar_url} size={36} />
        <h3 className="flex-1 text-headline-md">Votre réponse</h3>
        <DraftStatus savedAt={autosave.savedAt} />
      </div>
      <MarkdownEditor
        value={body}
        onChange={setBody}
        invalid={findings.length > 0}
        maxLength={10000}
        placeholder="Expliquez la solution, avec un exemple de code si possible."
        label="Votre réponse"
      />
      <SecretAlert findings={findings} />
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button onClick={submit} loading={create.isPending} disabled={!body.trim() || findings.length > 0}>
          <Send className="size-4" aria-hidden /> Publier ma réponse
        </Button>
      </div>
    </Card>
  );
}
