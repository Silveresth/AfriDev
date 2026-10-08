'use client';

import { ArrowRight, CircleDot, ExternalLink, Github, Pencil, RefreshCw, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ApplyButton, OwnerPanel } from '@/features/matchmaking';
import { ProjectGuide } from '@/features/onboarding-agent';
import { TwoColumns } from '@/shared/layout';
import { formatCount } from '@/shared/lib';
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
        <div className="relative h-24 sm:h-28" style={{ backgroundColor: profileColorHex(project.name) }} aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1.2px)] bg-[length:14px_14px] [mask-image:linear-gradient(105deg,transparent_10%,black_75%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/15" />
        </div>
        <div className="px-4 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <span
              className="-mt-10 flex size-20 items-center justify-center rounded-2xl border-4 border-card text-[2rem] font-bold text-white shadow-card"
              style={{ backgroundColor: profileColorHex(project.name) }}
            >
              {project.name.slice(0, 1).toUpperCase()}
            </span>
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
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <ProjectGuide projectId={project.id} repoUrl={project.repo_url} />
      </Card>
      <GoodFirstIssues projectId={project.id} />
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
