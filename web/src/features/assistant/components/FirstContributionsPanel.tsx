'use client';

import { ExternalLink, Footprints, GitPullRequest, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { Button, Card, EmptyState, StatusBadge } from '@/shared/ui';

import { useFirstContributions } from '../api';

/**
 * Premières contributions : l'IA choisit, parmi les issues ouvertes des projets de la
 * communauté (marquées « good first issue » ou non), celles qui conviennent au membre.
 */
export function FirstContributionsPanel() {
  const search = useFirstContributions();
  const picks = search.data?.picks;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-secondary-soft text-on-secondary-soft">
            <GitPullRequest className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-headline-md text-ink">Ma première contribution</h2>
            <p className="text-body-sm text-ink-muted">Des tâches accessibles dans les projets open source de la communauté, choisies pour votre stack.</p>
          </div>
        </div>
        <Button onClick={() => search.mutate()} loading={search.isPending}>
          <Sparkles className="size-4" aria-hidden /> {picks ? 'Chercher à nouveau' : 'Trouver des tâches'}
        </Button>
      </Card>
      {search.isError ? <p className="text-body-sm text-danger">{errorMessage(search.error)}</p> : null}

      {picks && !picks.length ? (
        <EmptyState icon={<GitPullRequest aria-hidden />} title="Rien d’adapté pour le moment">
          Les projets de la communauté n&apos;ont pas encore d&apos;issue accessible pour votre stack. Revenez bientôt, ou parcourez les{' '}
          <Link href="/projects" className="font-semibold text-primary-ink hover:underline">
            projets
          </Link>
          .
        </EmptyState>
      ) : null}

      {picks?.length ? (
        <ul className="space-y-3">
          {picks.map((pick) => (
            <li key={pick.issue_id}>
              <Card className="space-y-2.5 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/projects/${pick.project.id}`} className="text-body-sm font-semibold text-ink-muted hover:text-ink hover:underline">
                    {pick.project.name}
                  </Link>
                  {pick.project.language ? <span className="text-label-md text-ink-faint">· {pick.project.language}</span> : null}
                  <StatusBadge tone={pick.level === 'facile' ? 'success' : 'warning'} dot={false}>
                    {pick.level === 'facile' ? 'Facile' : 'Moyen'}
                  </StatusBadge>
                  {pick.labeled ? (
                    <StatusBadge tone="primary" dot={false}>
                      good first issue
                    </StatusBadge>
                  ) : null}
                </div>
                <a
                  href={pick.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-1.5 text-body-lg font-semibold text-ink hover:text-primary-ink"
                >
                  <span>
                    <span className="font-mono text-ink-faint">#{pick.number}</span> {pick.title}
                  </span>
                  <ExternalLink className="mt-1 size-4 shrink-0 text-ink-faint group-hover:text-primary-ink" aria-hidden />
                </a>
                {pick.why ? <p className="text-body-sm text-ink-muted">{pick.why}</p> : null}
                {pick.first_step ? (
                  <p className={cn('flex gap-2 rounded-lg bg-container-low px-3 py-2 text-body-sm text-ink')}>
                    <Footprints className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
                    <span>
                      <span className="font-semibold">Premier pas : </span>
                      {pick.first_step}
                    </span>
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
