'use client';

import { Bug, Gauge, ShieldAlert, Sparkles, Wrench, type LucideIcon } from 'lucide-react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Button, Card, CopyButton } from '@/shared/ui';

import { type CodeIssue, useCodeReview } from '../api';

const CATEGORY: Record<string, { label: string; icon: LucideIcon }> = {
  bug: { label: 'Bug', icon: Bug },
  securite: { label: 'Sécurité', icon: ShieldAlert },
  performance: { label: 'Performance', icon: Gauge },
  robustesse: { label: 'Robustesse', icon: Wrench },
  lisibilite: { label: 'Lisibilité', icon: Sparkles },
};

const SEVERITY: Record<CodeIssue['severity'], string> = {
  critique: 'bg-danger-soft text-on-danger-soft',
  important: 'bg-tertiary-soft text-on-tertiary-soft',
  mineur: 'bg-container text-ink-muted',
};

/** Relecture IA d'un snippet : bugs, sécurité, performance, avec suggestions applicables. */
export function CodeReviewPanel({ snippetId }: { snippetId: string }) {
  const { isAuthenticated } = useSession();
  const review = useCodeReview();
  const result = review.data;
  if (!isAuthenticated) return null;

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-headline-md text-ink">
            <Sparkles className="size-5 text-primary-ink" aria-hidden /> Relecture IA
          </h2>
          <p className="text-body-sm text-ink-muted">Bugs, failles de sécurité, performances : avec une correction à appliquer.</p>
        </div>
        <Button size="sm" onClick={() => review.mutate({ snippet_id: snippetId })} loading={review.isPending}>
          {result ? 'Relancer la relecture' : 'Relire ce code'}
        </Button>
      </div>
      {review.isError ? <p className="text-body-sm text-danger">{errorMessage(review.error)}</p> : null}
      {result ? (
        <div className="space-y-3">
          <p className="flex items-center gap-3 rounded-xl bg-container-low px-4 py-3 text-body-sm text-ink">
            <span className={cn('text-headline-md font-bold tabular-nums', result.score >= 70 ? 'text-secondary' : result.score >= 45 ? 'text-tertiary' : 'text-danger')}>
              {result.score}/100
            </span>
            {result.summary}
          </p>
          {result.issues.length ? (
            <ul className="space-y-3">
              {result.issues.map((issue, index) => {
                const category = CATEGORY[issue.category] ?? CATEGORY.robustesse!;
                return (
                  <li key={index} className="rounded-xl border border-line p-3.5">
                    <p className="flex flex-wrap items-center gap-2 text-body-sm">
                      <span className={cn('rounded-full px-2 py-0.5 text-label-sm font-semibold', SEVERITY[issue.severity])}>{issue.severity}</span>
                      <span className="inline-flex items-center gap-1 text-ink-muted">
                        <category.icon className="size-3.5" aria-hidden /> {category.label}
                      </span>
                      {issue.line ? <span className="font-mono text-label-md text-ink-faint">ligne {issue.line}</span> : null}
                    </p>
                    <p className="mt-1.5 font-semibold text-ink">{issue.title}</p>
                    {issue.detail ? <p className="text-body-sm text-ink-muted">{issue.detail}</p> : null}
                    {issue.suggestion ? (
                      <div className="relative mt-2">
                        <pre className="overflow-x-auto rounded-lg bg-container-low p-3 pr-20 font-mono text-label-md whitespace-pre-wrap text-ink">{issue.suggestion}</pre>
                        <CopyButton text={issue.suggestion} label="Copier" className="absolute top-2 right-2 h-7 px-2 text-xs" />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-body-sm text-secondary">Aucun problème notable : beau travail.</p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
