'use client';

import { ArrowRight, CheckCircle2, FolderGit2, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { Button, Card } from '@/shared/ui';

import { type ProfileAction, useProfileReview } from '../api';

/** Où mène chaque conseil (pages existantes du site). */
const ACTIONS: Record<Exclude<ProfileAction, 'none'>, { href: string; label: string }> = {
  edit_profile: { href: '/profile', label: 'Modifier mon profil' },
  link_github: { href: '/profile', label: 'Relier GitHub' },
  pin_content: { href: '/profile', label: 'Épingler un contenu' },
  answer_questions: { href: '/questions', label: 'Aider sur une question' },
  publish_snippet: { href: '/snippets/new', label: 'Publier un snippet' },
  add_project: { href: '/projects/new', label: 'Ajouter un projet' },
  open_to_work: { href: '/profile', label: 'Activer Open to Work' },
};

const tone = (score: number) => (score >= 75 ? 'text-secondary' : score >= 50 ? 'text-tertiary' : 'text-danger');

/** Analyse IA du profil et du compte GitHub : score, points forts, actions concrètes. */
export function ProfileReviewPanel() {
  const review = useProfileReview();
  const result = review.data;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
            <TrendingUp className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-headline-md text-ink">Analyse de mon profil</h2>
            <p className="text-body-sm text-ink-muted">Profil AfriDev, activité, Craft Score et dépôts GitHub publics.</p>
          </div>
        </div>
        <Button onClick={() => review.mutate()} loading={review.isPending}>
          <Sparkles className="size-4" aria-hidden /> {result ? 'Relancer l’analyse' : 'Analyser mon profil'}
        </Button>
      </Card>
      {review.isError ? <p className="text-body-sm text-danger">{errorMessage(review.error)}</p> : null}

      {result ? (
        <div className="space-y-4">
          <Card className="flex items-center gap-5 p-4 sm:p-5">
            <span className={cn('text-[2.75rem] leading-none font-bold tabular-nums', tone(result.score))}>
              {result.score}
              <span className="text-body-lg font-semibold text-ink-faint">/100</span>
            </span>
            <p className="text-body-md text-ink">{result.headline}</p>
          </Card>

          {result.strengths.length ? (
            <Card className="p-4 sm:p-5">
              <h3 className="mb-2 text-label-md font-semibold text-ink-faint uppercase">Vos points forts</h3>
              <ul className="space-y-1.5">
                {result.strengths.map((item) => (
                  <li key={item} className="flex gap-2 text-body-sm text-ink">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {result.improvements.length ? (
            <Card className="p-4 sm:p-5">
              <h3 className="mb-3 text-label-md font-semibold text-ink-faint uppercase">À faire en priorité</h3>
              <ol className="space-y-3">
                {result.improvements.map((item, index) => {
                  const action = item.action !== 'none' ? ACTIONS[item.action] : null;
                  return (
                    <li key={index} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-label-md font-bold text-on-primary">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{item.title}</p>
                        <p className="text-body-sm text-ink-muted">{item.detail}</p>
                        {action ? (
                          <Link href={action.href} className="mt-1 inline-flex items-center gap-1 text-body-sm font-semibold text-primary-ink hover:underline">
                            {action.label} <ArrowRight className="size-3.5" aria-hidden />
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          ) : null}

          {result.github.length ? (
            <Card className="p-4 sm:p-5">
              <h3 className="mb-2 flex items-center gap-2 text-label-md font-semibold text-ink-faint uppercase">
                <FolderGit2 className="size-4" aria-hidden /> Vos dépôts GitHub
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-body-sm text-ink">
                {result.github.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
