'use client';

import { Banknote, Building2, Ellipsis, ExternalLink, Globe2, MapPin, Trash2, XCircle } from 'lucide-react';

import { useSession } from '@/shared/session';
import { buttonClasses, communityColor, Menu, MenuItem, StatusBadge, Tag, TimeAgo, useToast } from '@/shared/ui';

import { CONTRACTS, type Job, useJobActions } from '../api';

/** Initiale de l'entreprise sur une couleur stable (aucun logo téléchargé). */
export function CompanyMark({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-lg font-semibold text-white ${communityColor(name)}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export const jobPlace = (job: Pick<Job, 'location' | 'country'>) => [job.location, job.country].filter(Boolean).join(', ');

/** Carte d'offre : entreprise, intitulé, lieu / télétravail, contrat, stack, salaire, « Postuler ». */
export function JobCard({ job }: { job: Job }) {
  const { user } = useSession();
  const { close, remove } = useJobActions();
  const toast = useToast();
  const mine = Boolean(user && job.author?.id === user.id);
  const place = jobPlace(job);

  return (
    <article className="rounded-2xl border border-line bg-card p-4 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raised sm:p-5">
      <div className="flex items-start gap-3.5">
        <CompanyMark name={job.company} />
        <div className="min-w-0 flex-1">
          <h3 className="text-body-lg font-semibold text-ink">{job.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" aria-hidden /> {job.company}
            </span>
            {place ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {place}
              </span>
            ) : null}
            {job.salary_range ? (
              <span className="inline-flex items-center gap-1">
                <Banknote className="size-3.5" aria-hidden /> {job.salary_range}
              </span>
            ) : null}
          </p>
        </div>
        {mine ? (
          <Menu
            className="w-56"
            trigger={(props) => (
              <button type="button" aria-label="Gérer l'offre" {...props} className="flex size-8 items-center justify-center rounded-lg text-ink-faint hover:bg-container hover:text-ink">
                <Ellipsis className="size-4" aria-hidden />
              </button>
            )}
          >
            <MenuItem
              onSelect={() =>
                close.mutate({ id: job.id, active: !job.is_active }, { onSuccess: () => toast(job.is_active ? 'Offre marquée comme pourvue.' : 'Offre republiée.') })
              }
            >
              <XCircle aria-hidden /> {job.is_active ? 'Marquer comme pourvue' : 'Republier'}
            </MenuItem>
            <MenuItem danger onSelect={() => window.confirm('Supprimer cette offre ?') && remove.mutate(job.id)}>
              <Trash2 aria-hidden /> Supprimer
            </MenuItem>
          </Menu>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge tone="primary" dot={false}>
          {CONTRACTS[job.contract_type]}
        </StatusBadge>
        {job.is_remote ? (
          <StatusBadge tone="success" dot={false}>
            <Globe2 className="size-3" aria-hidden /> Télétravail
          </StatusBadge>
        ) : null}
        {!job.is_active ? <StatusBadge tone="neutral">Pourvue</StatusBadge> : null}
        <span className="-ml-0.5 flex flex-wrap gap-0.5">
          {job.stack.map((tech) => (
            <Tag key={tech}>{tech}</Tag>
          ))}
        </span>
      </div>

      <p className="mt-3 line-clamp-3 text-body-sm text-ink-muted">{job.description}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-label-md text-ink-faint">
          Publiée <TimeAgo date={job.created_at} />
          {job.author ? ` par ${job.author.display_name}` : ''}
        </span>
        {job.is_active ? (
          <a href={job.apply_url} target="_blank" rel="noopener noreferrer nofollow" className={buttonClasses({ size: 'sm' })}>
            Postuler <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
    </article>
  );
}
