'use client';

import { ArrowUp, BookOpen, Code2, FolderGit2, MessagesSquare, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { Avatar, Button, Markdown, Textarea } from '@/shared/ui';
import { useSession } from '@/shared/session';

import { type AskAnswer, type AskTurn, useAsk } from '../api';

interface Exchange {
  question: string;
  answer?: AskAnswer;
  error?: string;
}

const EXAMPLES = [
  'Comment intégrer un paiement mobile money dans une API Django ?',
  'Quelles bonnes pratiques pour une appli qui marche hors ligne ?',
  'Comment préparer un entretien de développeur React ?',
];

const SOURCE_ICONS: Record<string, typeof BookOpen> = { question: MessagesSquare, snippet: Code2, project: FolderGit2 };

/**
 * « Demande à AfriDev » : discussion avec l'IA, dont les réponses s'appuient sur les questions,
 * snippets et projets publiés par la communauté (sources numérotées et cliquables).
 */
export function AskPanel() {
  const { profile } = useSession();
  const ask = useAsk();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [exchanges.length, ask.isPending]);

  const send = (text: string) => {
    const question = text.trim();
    if (question.length < 3 || ask.isPending) return;
    const history: AskTurn[] = exchanges
      .filter((exchange) => exchange.answer)
      .flatMap((exchange) => [
        { role: 'user' as const, content: exchange.question },
        { role: 'assistant' as const, content: exchange.answer!.answer.slice(0, 1500) },
      ])
      .slice(-6);
    setExchanges((current) => [...current, { question }]);
    setDraft('');
    ask.mutate(
      { question, history },
      {
        onSuccess: (answer) => setExchanges((current) => current.map((e, i) => (i === current.length - 1 ? { ...e, answer } : e))),
        onError: (error) => setExchanges((current) => current.map((e, i) => (i === current.length - 1 ? { ...e, error: errorMessage(error) } : e))),
      },
    );
  };

  const name = profile?.display_name || profile?.username || 'Vous';

  return (
    <div className="flex min-h-[28rem] flex-col">
      <div className="flex-1 space-y-5">
        {!exchanges.length ? (
          <div className="rounded-2xl border border-dashed border-line-strong p-5 text-center">
            <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <p className="font-semibold text-ink">Posez votre question à AfriDev</p>
            <p className="mx-auto mt-1 max-w-md text-body-sm text-ink-muted">
              Les réponses s&apos;appuient sur ce que la communauté a déjà publié : questions résolues, snippets, projets. Les sources sont citées.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => send(example)}
                  className="rounded-full border border-line bg-card px-3 py-1.5 text-body-sm text-ink-muted transition-colors hover:border-primary/40 hover:text-ink"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {exchanges.map((exchange, index) => (
          <div key={index} className="space-y-3">
            <div className="flex justify-end gap-2.5">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-body-md whitespace-pre-line text-on-primary">{exchange.question}</p>
              <Avatar name={name} src={profile?.avatar_url} size={32} />
            </div>
            <div className="flex gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-card px-4 py-3">
                {exchange.answer ? (
                  <>
                    <Markdown
                      source={exchange.answer.answer}
                      citeHref={(n) => exchange.answer!.sources.find((source) => source.n === n)?.url}
                      className="text-body-md"
                    />
                    {exchange.answer.sources.length ? (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="mb-1.5 text-label-md font-semibold text-ink-faint uppercase">Sources de la communauté</p>
                        <ul className="space-y-1">
                          {exchange.answer.sources.map((source) => {
                            const Icon = SOURCE_ICONS[source.type] ?? BookOpen;
                            return (
                              <li key={source.n}>
                                <Link href={source.url} className="flex items-center gap-2 text-body-sm text-primary-ink hover:underline">
                                  <span className="font-mono text-label-md text-ink-faint">[{source.n}]</span>
                                  <Icon className="size-3.5 shrink-0" aria-hidden />
                                  <span className="truncate">{source.title}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : exchange.error ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-body-sm text-danger">{exchange.error}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExchanges((current) => current.slice(0, index));
                        send(exchange.question);
                      }}
                    >
                      <RotateCcw className="size-3.5" aria-hidden /> Réessayer
                    </Button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-body-sm text-ink-muted">
                    <span className="size-2 animate-pulse rounded-full bg-primary" /> AfriDev cherche dans la communauté…
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      <form
        className="sticky bottom-0 mt-5 bg-background pt-2 pb-1"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-card p-2 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/10">
          <Textarea
            aria-label="Votre question"
            value={draft}
            maxLength={1000}
            rows={1}
            placeholder="Votre question technique ou sur la communauté…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
            className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent shadow-none focus:ring-0"
          />
          <Button type="submit" size="sm" aria-label="Envoyer" disabled={draft.trim().length < 3 || ask.isPending} className={cn('size-10 shrink-0 rounded-xl p-0')}>
            <ArrowUp className="size-5" aria-hidden />
          </Button>
        </div>
        <p className="mt-1.5 text-center text-label-md text-ink-faint">
          L&apos;IA peut se tromper : vérifiez le code avant de l&apos;utiliser. Entrée pour envoyer, Maj+Entrée pour aller à la ligne.
        </p>
      </form>
    </div>
  );
}
