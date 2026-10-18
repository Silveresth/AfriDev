'use client';

import { ArrowRight, CircleDot, ExternalLink, Github, Pencil, RefreshCw, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { TeamBuilder } from '@/features/assistant';
import { DetailActions, TargetComments } from '@/features/engage';
import { ApplyButton, OwnerPanel } from '@/features/matchmaking';
import { ProjectGuide } from '@/features/onboarding-agent';
import { TwoColumns } from '@/shared/layout';
import { formatCount } from '@/shared/lib';
import { absoluteMediaUrl } from '@/shared/media';
import { useSession } from '@/shared/session';
import {
  Avatar,
  Button,
  ButtonLink,
  buttonClasses,
  Card,
  CardSkeleton,
  ErrorNotice,
  profileColorHex,
  StatusBadge,
  Tag,
  TimeAgo,
} from '@/shared/ui';

import { type Project, useIssues, useProject, useProjectActions } from '../api';
import { repoSlug } from './ProjectCard';
import { RecruitingProjectsCard } from './RecruitingProjectsCard';

export function ProjectDetail({ id, initial }: { id: string; initial?: Project }) {
  const project = useProject(id, initial);
  const { user } = useSession();
  const mine = Boolean(user && project.data?.owner?.id === user.id);
  return (
    <TwoColumns aside={mine && project.data ? <OwnerPanel projectId={project.data.id} /> : <RecruitingProjectsCard />}>
      {project.data ? (
        <ProjectView project={project.data} mine={mine} />
      ) : project.isError ? (
        <ErrorNotice title="Projet introuvable" message="Il a peut-être été retiré, ou n'est pas encore disponible hors ligne." />
      ) : (
        <CardSkeleton lines={6} />
      )}
    </TwoColumns>
  );
}

/** Page projet façon page entreprise LinkedIn : bannière, logo, chiffres, puis guide et issues. */
function ProjectView({ project, mine }: { project: Project; mine: boolean }) {
  const router = useRouter();
  const { sync, remove } = useProjectActions(project.id);
  const owner = project.owner;

  return (
    <>
      <Card className="overflow-hidden">
        {project.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- image recompressée servie par le CDN
          <img src={absoluteMediaUrl(project.banner_url)} alt="" data-media className="h-32 w-full object-cover sm:h-44" />
        ) : (
          <div className="h-24 bg-container sm:h-28" aria-hidden />
        )}
        <div className="px-4 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            {project.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo recompressé servi par le CDN
              <img
                src={absoluteMediaUrl(project.logo_url)}
                alt=""
                className="-mt-10 size-20 rounded-2xl border-4 border-card bg-card object-cover shadow-card"
              />
            ) : (
              <span
                className="-mt-10 flex size-20 items-center justify-center rounded-2xl border-4 border-card text-[2rem] font-bold text-white shadow-card"
                style={{ backgroundColor: profileColorHex(project.name) }}
              >
                {project.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="flex flex-wrap gap-2 pt-3">
              {project.repo_url ? (
                <a
                  href={project.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses({ variant: 'ghost', size: 'sm' })}
                >
                  <Github className="size-4" aria-hidden /> Dépôt <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
              {mine ? (
                <ButtonLink href={`/projects/${project.id}/edit`} variant="ghost" size="sm">
                  <Pencil className="size-4" aria-hidden /> Modifier
                </ButtonLink>
              ) : (
                <div className="w-60">
                  <ApplyButton projectId={project.id} projectName={project.name} />
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-headline-xl text-ink">{project.name}</h1>
            {project.is_recruiting ? <StatusBadge tone="success">Recrute</StatusBadge> : null}
          </div>
          {project.repo_url ? <p className="text-body-md text-ink-muted">{repoSlug(project.repo_url)}</p> : null}
          {project.description ? <p className="mt-2 text-body-lg text-ink">{project.description}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm text-ink-muted">
            <span className="flex items-center gap-1">
              <Star className="size-4" aria-hidden /> {formatCount(project.stars)} étoile{project.stars > 1 ? 's' : ''}
            </span>
            {project.language ? <span>{project.language}</span> : null}
            {project.last_synced_at ? (
              <span>
                Synchronisé avec GitHub <TimeAgo date={project.last_synced_at} />
              </span>
            ) : null}
          </div>
          {project.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <Tag key={tag} href={`/feed?tag=${encodeURIComponent(tag)}`}>
                  {tag}
                </Tag>
              ))}
            </div>
          ) : null}
          {owner ? (
            <Link
              href={`/u/${owner.username}`}
              className="mt-4 flex w-fit items-center gap-2.5 rounded-xl bg-container-low px-3 py-2 hover:bg-container"
            >
              <Avatar name={owner.display_name} src={owner.avatar_url} size={32} />
              <span className="leading-tight">
                <span className="block text-body-sm text-ink-muted">Porté par</span>
                <span className="block text-body-md font-semibold text-ink">{owner.display_name}</span>
              </span>
            </Link>
          ) : null}
          {mine ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {project.repo_url ? (
                <Button variant="subtle" size="sm" onClick={() => sync.mutate()} loading={sync.isPending}>
                  <RefreshCw className="size-4" aria-hidden /> Synchroniser GitHub
                </Button>
              ) : null}
              <Button
                variant="plain"
                size="sm"
                className="hover:text-danger"
                onClick={async () => {
                  if (!window.confirm('Retirer ce projet ?')) return;
                  await remove.mutateAsync();
                  router.push('/projects');
                }}
              >
                <Trash2 className="size-4" aria-hidden /> Retirer le projet
              </Button>
            </div>
          ) : null}
          <div className="mt-4 border-t border-line pt-3">
            <DetailActions type="project" id={project.id} title={project.name} path={`/projects/${project.id}`} mine={mine} />
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <ProjectGuide projectId={project.id} repoUrl={project.repo_url} />
      </Card>
      <GoodFirstIssues projectId={project.id} />
      {mine ? <TeamBuilder projectId={project.id} /> : null}
      <TargetComments type="project" id={project.id} ownerId={owner?.id} />
    </>
  );
}

function GoodFirstIssues({ projectId }: { projectId: string }) {
  const issues = useIssues(projectId);
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 pb-3 sm:px-6">
        <h2 className="text-headline-md text-ink">Good first issues</h2>
        <p className="text-body-sm text-ink-muted">Importées du dépôt GitHub : idéales pour une première contribution.</p>
      </div>
      {issues.isPending ? (
        <div className="px-4 pb-4 sm:px-6">
          <CardSkeleton lines={2} />
        </div>
      ) : issues.data?.length ? (
        <ul className="divide-y divide-line border-t border-line">
          {issues.data.map((issue) => (
            <li key={issue.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-6">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-on-secondary-soft">
                <CircleDot className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">
                  <span className="text-ink-faint">#{issue.number}</span> {issue.title}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {issue.labels.map((label) => (
                    <StatusBadge key={label} tone={/first|débutant/i.test(label) ? 'success' : 'neutral'} dot={false}>
                      {label}
                    </StatusBadge>
                  ))}
                </div>
              </div>
              <a href={issue.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: 'sm' })}>
                Je la prends <ArrowRight className="size-4" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-line px-4 py-4 text-body-sm text-ink-muted sm:px-6">
          Aucune « good first issue » ouverte pour l&apos;instant.
        </p>
      )}
    </Card>
  );
}
