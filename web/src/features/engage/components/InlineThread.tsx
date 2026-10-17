'use client';

import type { Schemas } from '@afridev/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { sendComment, useComments } from '@/features/discussions';
import { useAnswers, useCreateAnswer } from '@/features/qa';
import { useAddComment, useSnippetComments } from '@/features/snippets';
import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { Avatar, buttonClasses, Button, Skeleton, Textarea, TimeAgo } from '@/shared/ui';

import { useTargetCommentActions, useTargetComments } from '../api';

export type ThreadKind = 'post' | 'snippet' | 'question' | 'project' | 'job';

interface Line {
  id: string;
  author: Schemas['Author'] | null;
  body: string;
  created_at: string;
}

const PREVIEW = 3;

/** Commentaires (post, snippet) ou réponses (question) ouverts sous la carte, sans changer de page. */
export function InlineThread({ kind, id, href }: { kind: ThreadKind; id: string; href: string }) {
  if (kind === 'post') return <PostThread id={id} href={href} />;
  if (kind === 'snippet') return <SnippetThread id={id} href={href} />;
  if (kind === 'project' || kind === 'job') return <TargetThread type={kind} id={id} href={href} />;
  return <AnswerThread id={id} href={href} />;
}

function TargetThread({ type, id, href }: { type: 'project' | 'job'; id: string; href: string }) {
  const comments = useTargetComments(type, id);
  const { send } = useTargetCommentActions(type, id);
  return (
    <Thread
      lines={comments.items}
      loading={comments.isPending}
      href={href}
      empty="Aucun commentaire pour l'instant : lancez la discussion."
      placeholder="Écrire un commentaire…"
      onSend={async (body) => {
        await send.mutateAsync({ body });
      }}
    />
  );
}

function PostThread({ id, href }: { id: string; href: string }) {
  const comments = useComments(id);
  const queryClient = useQueryClient();
  return (
    <Thread
      lines={comments.items}
      loading={comments.isPending}
      href={href}
      empty="Aucun commentaire pour l'instant : lancez la discussion."
      placeholder="Écrire un commentaire…"
      onSend={async (body) => {
        await sendComment(id, body);
        void queryClient.invalidateQueries({ queryKey: ['discussions', id] });
      }}
    />
  );
}

function SnippetThread({ id, href }: { id: string; href: string }) {
  const comments = useSnippetComments(id);
  const add = useAddComment(id);
  return (
    <Thread
      lines={comments.items}
      loading={comments.isPending}
      href={href}
      empty="Aucun commentaire pour l'instant : lancez la discussion."
      placeholder="Écrire un commentaire…"
      onSend={async (body) => {
        await add.mutateAsync({ body });
      }}
    />
  );
}

function AnswerThread({ id, href }: { id: string; href: string }) {
  const answers = useAnswers(id);
  const create = useCreateAnswer(id);
  return (
    <Thread
      lines={answers.data ?? []}
      loading={answers.isPending}
      href={href}
      empty="Aucune réponse pour l'instant : aidez en premier."
      placeholder="Votre réponse…"
      onSend={async (body) => {
        await create.mutateAsync(body);
      }}
    />
  );
}

function Thread({
  lines,
  loading,
  href,
  empty,
  placeholder,
  onSend,
}: {
  lines: Line[];
  loading: boolean;
  href: string;
  empty: string;
  placeholder: string;
  onSend: (body: string) => Promise<void>;
}) {
  const { isAuthenticated } = useSession();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = body.trim();
  const shown = lines.slice(-PREVIEW);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await onSend(text);
      setBody('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-line px-4 py-3 sm:px-5" onClick={(event) => event.stopPropagation()}>
      {loading ? (
        <Skeleton className="h-12" />
      ) : shown.length ? (
        <ul className="space-y-3">
          {shown.map((line) => {
            const name = line.author?.display_name || line.author?.username || 'Membre';
            return (
              <li key={line.id} className="flex gap-2.5">
                <Avatar name={name} src={line.author?.avatar_url} size={28} />
                <div className="min-w-0 flex-1 rounded-xl bg-container-low px-3 py-2">
                  <p className="flex items-center gap-1.5 text-label-md">
                    <span className="font-semibold text-ink">{name}</span>
                    <TimeAgo date={line.created_at} className="text-ink-faint" />
                  </p>
                  <p className="line-clamp-4 text-body-sm whitespace-pre-line text-ink">{line.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-body-sm text-ink-muted">{empty}</p>
      )}
      {lines.length > PREVIEW ? (
        <Link href={href} className="inline-block text-body-sm font-semibold text-primary-ink hover:underline">
          Voir les {lines.length} messages
        </Link>
      ) : null}

      {isAuthenticated ? (
        <form onSubmit={submit} className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={placeholder}
            maxLength={3000}
            rows={1}
            className="min-h-11 flex-1 resize-none py-2.5"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit(event);
            }}
          />
          <Button type="submit" size="sm" loading={sending} disabled={!text} aria-label="Envoyer">
            <Send className="size-4" aria-hidden />
          </Button>
        </form>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(href)}`} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
          Se connecter pour participer
        </Link>
      )}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
