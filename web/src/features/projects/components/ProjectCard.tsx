'use client';

import { Check, CircleDot, Star, UserPlus } from 'lucide-react';
import Link from 'next/link';

import { cn, formatCount, initials } from '@/shared/lib';
import { Card, StatusBadge } from '@/shared/ui';

export interface ProjectCardData {
  id: string;
  name: string;
  description: string;
  repo_url: string;
  tags: string[];
  stars: number;
  open_issue_count?: number;
  is_recruiting?: boolean;
}

export function repoSlug(url: string) {
  return url.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '');
}

/** Carte de projet : affinité et technologies en commun quand c'est une recommandation. */
export function ProjectCard({
  project,
  score,
  matched = [],
  className,
}: {
  project: ProjectCardData;
  score?: number;
  matched?: string[];
  className?: string;
}) {
  return (
    <Card className={cn('relative flex flex-col gap-3 p-4 transition-colors hover:border-primary', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded bg-primary font-semibold text-on-primary">
            {initials(project.name)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-headline-md">
              <Link href={`/projects/${project.id}`} className="after:absolute after:inset-0 hover:text-primary-ink">
                {project.name}
              </Link>
            </h3>
            {project.repo_url ? (
              <p className="truncate text-label-md text-ink-muted">{repoSlug(project.repo_url)}</p>
            ) : null}
          </div>
        </div>
        {score !== undefined ? (
          <StatusBadge tone="success">{Math.round(score * 100)} % affinité</StatusBadge>
        ) : project.is_recruiting ? (
          <StatusBadge tone="primary" dot={false}>
            <UserPlus className="size-3" aria-hidden /> Recrute
          </StatusBadge>
        ) : null}
      </div>
      {project.description ? <p className="line-clamp-3 text-body-sm text-ink-muted">{project.description}</p> : null}
      {project.tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {project.tags.slice(0, 6).map((tag) => {
            const match = matched.includes(tag);
            return (
              <span
                key={tag}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-body-sm',
                  match ? 'border-primary/40 bg-primary-soft text-primary-ink' : 'border-line bg-container-low text-ink-muted',
                )}
              >
                {match ? <Check className="size-3" aria-hidden /> : null}
                {tag}
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-4 border-t border-line pt-2 text-label-md text-ink-muted">
        <span className="flex items-center gap-1"><Star className="size-3.5" aria-hidden /> {formatCount(project.stars)}</span>
        {project.open_issue_count !== undefined ? (
          <span className="flex items-center gap-1 text-secondary-ink">
            <CircleDot className="size-3.5" aria-hidden /> {project.open_issue_count} good first issue{project.open_issue_count > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
