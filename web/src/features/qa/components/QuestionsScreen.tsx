'use client';

import { CheckCircle2, CircleDashed, Clock, Layers, MessageCircle, MessagesSquare, Plus, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { BookmarkButton } from '@/features/bookmarks';
import { PageHeader, Toolbar, TwoColumns } from '@/shared/layout';
import { cn } from '@/shared/lib';
import { useOutbox } from '@/shared/offline';
import { useSession } from '@/shared/session';
import {
  AuthorBadges,
  Avatar,
  Button,
  ButtonLink,
  Card,
  CardSkeleton,
  CommunityIcon,
  EmptyState,
  ErrorNotice,
  HubLink,
  KarmaPill,
  SearchField,
  Segmented,
  StatusBadge,
  Tag,
  TimeAgo,
} from '@/shared/ui';

import { type Question, useQuestions } from '../api';

type Status = 'all' | 'open' | 'resolved';

export function QuestionsScreen({ aside }: { aside?: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const status = (params.get('status') as Status | null) ?? 'all';
  const tag = params.get('tag') ?? undefined;
  const query = params.get('q') ?? undefined;
  const questions = useQuestions({ q: query, tag, resolved: status === 'all' ? undefined : status === 'resolved' });
  const pending = useOutbox('questions');
  const { isAuthenticated } = useSession();

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/questions${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  return (
    <TwoColumns aside={aside}>
      <PageHeader
        className="mb-2"
        icon={<MessagesSquare aria-hidden />}
        title="Questions & réponses"
        description="Une première réponse de l'IA en quelques secondes, puis la communauté."
        actions={
          <ButtonLink href={isAuthenticated ? '/questions/new' : '/login?next=/questions/new'} className="w-full sm:w-auto">
            <Plus className="size-4" aria-hidden /> Poser une question
          </ButtonLink>
        }
      />

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          update('q', search.trim() || null);
        }}
      >
        <SearchField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un bug, un code d'erreur, une techno…"
          aria-label="Rechercher dans les questions"
          className="[&_input]:h-12 [&_input]:text-body-lg"
        />
      </form>

      <Toolbar>
        <Segmented<Status>
          value={status}
          onChange={(value) => update('status', value === 'all' ? null : value)}
          options={[
            { value: 'all', label: 'Toutes', icon: <Layers aria-hidden /> },
            { value: 'open', label: 'Sans solution', icon: <CircleDashed aria-hidden /> },
            { value: 'resolved', label: 'Résolues', icon: <CheckCircle2 aria-hidden /> },
          ]}
        />
        {tag || query ? (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              router.replace('/questions', { scroll: false });
            }}
            className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary-soft px-3 text-body-sm font-medium text-primary-ink"
          >
            {tag ? `d/${tag}` : `« ${query} »`} <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </Toolbar>

      {pending.map((entry) => (
        <Card key={entry.id} className="flex items-start gap-3 border-dashed p-4">
          <Clock className="mt-1 size-4 text-offline" aria-hidden />
          <div>
            <StatusBadge tone="offline">En attente de réseau</StatusBadge>
            <p className="mt-1 font-semibold text-ink">{String(entry.data.title)}</p>
          </div>
        </Card>
      ))}

      {questions.isPending ? (
        <>
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </>
      ) : questions.isError && !questions.items.length ? (
        <ErrorNotice message="Les questions s'afficheront dès le retour du réseau." />
      ) : !questions.items.length ? (
        <EmptyState
          icon={<MessagesSquare className="size-7" aria-hidden />}
          title="Aucune question trouvée"
          action={<ButtonLink href="/questions/new">Poser la première</ButtonLink>}
        >
          Changez de filtre ou posez votre question : l&apos;IA vous répond tout de suite.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {questions.items.map((question) => (
            <li key={question.id}>
              <QuestionRow question={question} />
            </li>
          ))}
        </ul>
      )}
      {questions.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => questions.fetchNextPage()} loading={questions.isFetchingNextPage}>
          Voir plus de questions
        </Button>
      ) : null}
    </TwoColumns>
  );
}

/**
 * Carte Q&A : compteur de réponses à gauche (vert plein si résolue, façon Stack Overflow),
 * statut explicite [Résolu / En attente], auteur avec ses badges, hub, titre, extrait et tags.
 */
export function QuestionRow({ question, compact = false }: { question: Question; compact?: boolean }) {
  const name = question.author?.display_name || question.author?.username || 'Membre';
  const [community, ...rest] = question.tags;
  const tags = question.hub ? question.tags : rest;
  const resolved = question.is_resolved;
  const answers = question.answer_count;
  return (
    <article className="group relative flex gap-4 rounded-2xl border border-line bg-card p-4 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raised sm:p-5">
      <div
        className={cn(
          'hidden w-16 shrink-0 flex-col items-center justify-center self-start rounded-xl border py-2 sm:flex',
          resolved
            ? 'border-secondary bg-secondary text-white'
            : answers
              ? 'border-secondary/40 text-secondary-ink'
              : 'border-line text-ink-muted',
        )}
        aria-hidden
      >
        {resolved ? <CheckCircle2 className="mb-0.5 size-4" aria-hidden /> : null}
        <span className="text-headline-md leading-none tabular-nums">{answers}</span>
        <span className="mt-0.5 text-label-sm">réponse{answers > 1 ? 's' : ''}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-md text-ink-faint">
          <span className="relative z-10 flex min-w-0 items-center gap-1.5">
            <Avatar name={name} src={question.author?.avatar_url} size={20} />
            {question.author ? (
              <Link href={`/u/${question.author.username}`} className="truncate text-body-sm font-medium text-ink hover:underline">
                {name}
              </Link>
            ) : (
              <span className="truncate text-body-sm font-medium text-ink">{name}</span>
            )}
          </span>
          <AuthorBadges location={question.author?.location} stack={question.author?.stack} className="relative z-10" />
          {question.author?.karma ? <KarmaPill karma={question.author.karma} /> : null}
          <span aria-hidden>·</span>
          <TimeAgo date={question.created_at} className="shrink-0" />
          {question.hub ? (
            <>
              <span aria-hidden>·</span>
              <HubLink hub={question.hub} className="relative z-10" />
            </>
          ) : community ? (
            <>
              <span aria-hidden>·</span>
              <Link
                href={`/questions?tag=${encodeURIComponent(community)}`}
                className="relative z-10 inline-flex items-center gap-1 font-medium text-ink-muted hover:text-ink hover:underline"
              >
                <CommunityIcon tag={community} size={14} className="rounded-[4px]" />
                d/{community}
              </Link>
            </>
          ) : null}
        </div>

        <h3 className="mt-2 text-[1.0625rem] leading-snug font-semibold tracking-[-0.01em] text-ink transition-colors group-hover:text-primary-ink">
          <Link href={`/questions/${question.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
            {question.title}
          </Link>
        </h3>
        {!compact && question.body ? <p className="mt-1 line-clamp-2 text-body-sm text-ink-muted">{question.body}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {resolved ? (
            <StatusBadge tone="success" dot={false}>
              <CheckCircle2 className="size-3.5" aria-hidden /> Résolu
            </StatusBadge>
          ) : (
            <StatusBadge tone="warning">En attente</StatusBadge>
          )}
          {/* Sur téléphone, le compteur de gauche est masqué : le nombre de réponses passe ici. */}
          <span className="inline-flex h-6 items-center gap-1 text-label-md text-ink-muted sm:hidden">
            <MessageCircle className="size-3.5" aria-hidden /> {answers} réponse{answers > 1 ? 's' : ''}
          </span>
          {question.ai_answer_status === 'ready' ? (
            <StatusBadge tone="primary" dot={false}>
              <Sparkles className="size-3" aria-hidden /> Réponse IA
            </StatusBadge>
          ) : null}
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className="relative z-10">
              <Tag href={`/questions?tag=${encodeURIComponent(tag)}`}>{tag}</Tag>
            </span>
          ))}
          <span className="relative z-10 ml-auto">
            <BookmarkButton target={{ type: 'question', id: question.id }} title={question.title} />
          </span>
        </div>
      </div>
    </article>
  );
}
