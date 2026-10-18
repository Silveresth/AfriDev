'use client';

import { CheckCircle2, CircleAlert, GraduationCap, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Button, buttonClasses, Card } from '@/shared/ui';

import { useJobMatch } from '../api';

const tone = (score: number) => (score >= 70 ? 'text-secondary' : score >= 45 ? 'text-tertiary' : 'text-danger');

/** « Vous correspondez à 82 % » : points forts, écarts et mini-parcours pour les combler. */
export function JobMatchCard({ jobId }: { jobId: string }) {
  const { isAuthenticated } = useSession();
  const match = useJobMatch();
  const result = match.data;

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-headline-md text-ink">Votre correspondance avec l’offre</h2>
            <p className="text-body-sm text-ink-muted">Analyse IA de votre profil, de votre stack et de votre GitHub.</p>
          </div>
        </div>
        {!isAuthenticated ? (
          <Link href={`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`} className={buttonClasses({ size: 'sm', variant: 'outline' })}>
            Se connecter pour voir mon score
          </Link>
        ) : (
          <Button size="sm" onClick={() => match.mutate(jobId)} loading={match.isPending}>
            {result ? 'Recalculer' : 'Calculer mon score'}
          </Button>
        )}
      </div>
      {match.isError ? <p className="text-body-sm text-danger">{errorMessage(match.error)}</p> : null}
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className={cn('text-[2.5rem] leading-none font-bold tabular-nums', tone(result.score))}>{result.score}%</span>
            <p className="text-body-md text-ink">{result.verdict}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <section>
              <h3 className="mb-1.5 text-label-md font-semibold text-ink-faint uppercase">Points forts</h3>
              <ul className="space-y-1.5">
                {result.strengths.map((item) => (
                  <li key={item} className="flex gap-2 text-body-sm text-ink">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-1.5 text-label-md font-semibold text-ink-faint uppercase">À renforcer</h3>
              <ul className="space-y-1.5">
                {result.gaps.map((item) => (
                  <li key={item} className="flex gap-2 text-body-sm text-ink">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-tertiary" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          {result.plan.length ? (
            <section className="rounded-xl bg-container-low p-4">
              <h3 className="mb-2 flex items-center gap-2 text-body-sm font-semibold text-ink">
                <GraduationCap className="size-4" aria-hidden /> Votre mini-parcours
              </h3>
              <ol className="space-y-2">
                {result.plan.map((step, index) => (
                  <li key={index} className="flex gap-2.5 text-body-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-label-sm font-bold text-on-primary">
                      {index + 1}
                    </span>
                    <span>
                      <span className="text-ink">{step.step}</span>
                      {step.resource ? <span className="block text-ink-muted">{step.resource}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
