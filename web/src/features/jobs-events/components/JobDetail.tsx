'use client';

import { ArrowLeft, Banknote, Building2, ExternalLink, Globe2, MapPin, Pencil, Trash2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { JobMatchCard } from '@/features/assistant';
import { DetailActions, TargetComments } from '@/features/engage';
import { TwoColumns } from '@/shared/layout';
import { useSession } from '@/shared/session';
import { Avatar, Button, buttonClasses, Card, CardSkeleton, ErrorNotice, StatusBadge, Tag, TimeAgo, useToast } from '@/shared/ui';

import { CONTRACTS, type Job, useJob, useJobActions } from '../api';
import { CompanyMark, jobPlace } from './JobCard';
import { JobFormDialog } from './JobFormDialog';
import { RecentJobsCard } from './Widgets';

/** /jobs/<id> : l'offre complète, avec votes, commentaires, partage et enregistrement. */
export function JobDetail({ id, initial }: { id: string; initial?: Job }) {
  const job = useJob(id, initial);
  return (
    <TwoColumns aside={<RecentJobsCard />}>
      <Link href="/jobs" className="mb-3 inline-flex items-center gap-1.5 text-body-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Job Board
      </Link>
      {job.data ? (
        <JobView job={job.data} />
      ) : job.isError ? (
        <ErrorNotice title="Offre introuvable" message="Elle a peut-être été pourvue puis retirée." />
      ) : (
        <CardSkeleton lines={6} />
      )}
    </TwoColumns>
  );
}

function JobView({ job }: { job: Job }) {
  const { user } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { close, remove } = useJobActions();
  const mine = Boolean(user && (job.author?.id === user.id || user.is_staff));
  const [editing, setEditing] = useState(mine && params.get('edit') === '1');
  const place = jobPlace(job);
  const path = `/jobs/${job.id}`;

  return (
    <>
      <Card className="space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <CompanyMark name={job.company} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-headline-lg text-ink">{job.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-md text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-4" aria-hidden /> {job.company}
              </span>
              {place ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden /> {place}
                </span>
              ) : null}
              {job.salary_range ? (
                <span className="inline-flex items-center gap-1">
                  <Banknote className="size-4" aria-hidden /> {job.salary_range}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone="primary" dot={false}>
            {CONTRACTS[job.contract_type]}
          </StatusBadge>
          {job.is_remote ? (
            <StatusBadge tone="success" dot={false}>
              <Globe2 className="size-3" aria-hidden /> Télétravail
            </StatusBadge>
          ) : null}
          {!job.is_active ? <StatusBadge tone="neutral">Pourvue</StatusBadge> : null}
          {job.stack.map((tech) => (
            <Tag key={tech} href={`/jobs?tech=${encodeURIComponent(tech)}`}>
              {tech}
            </Tag>
          ))}
        </div>

        <p className="text-body-md whitespace-pre-line text-ink">{job.description}</p>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {job.author ? (
            <Link href={`/u/${job.author.username}`} className="flex items-center gap-2.5 rounded-xl bg-container-low px-3 py-2 hover:bg-container">
              <Avatar name={job.author.display_name} src={job.author.avatar_url} size={36} />
              <span className="leading-tight">
                <span className="block text-body-sm text-ink-muted">
                  Publiée <TimeAgo date={job.created_at} /> par
                </span>
                <span className="block text-body-md font-semibold text-ink">{job.author.display_name}</span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            {mine ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden /> Modifier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    close.mutate(
                      { id: job.id, active: !job.is_active },
                      { onSuccess: () => toast(job.is_active ? 'Offre marquée comme pourvue.' : 'Offre republiée.') },
                    )
                  }
                >
                  <XCircle className="size-4" aria-hidden /> {job.is_active ? 'Pourvue' : 'Republier'}
                </Button>
                <Button
                  variant="plain"
                  size="sm"
                  className="hover:text-danger"
                  onClick={async () => {
                    if (!window.confirm('Supprimer cette offre ?')) return;
                    await remove.mutateAsync(job.id);
                    router.push('/jobs');
                  }}
                >
                  <Trash2 className="size-4" aria-hidden /> Supprimer
                </Button>
              </>
            ) : null}
            {job.is_active ? (
              <a href={job.apply_url} rel="noopener noreferrer nofollow" className={buttonClasses({ size: 'sm' })}>
                Postuler <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>

        <div className="border-t border-line pt-3">
          <DetailActions type="job" id={job.id} title={`${job.title} — ${job.company}`} path={path} mine={mine} />
        </div>
      </Card>

      {!mine && job.is_active ? <JobMatchCard jobId={job.id} /> : null}
      <TargetComments type="job" id={job.id} ownerId={job.author?.id} />
      {editing ? <JobFormDialog open job={job} onClose={() => setEditing(false)} /> : null}
    </>
  );
}
