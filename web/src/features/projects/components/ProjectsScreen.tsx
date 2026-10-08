'use client';

import { FolderGit2, GitPullRequest, Layers, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useMyApplications, useRecommendedProjects } from '@/features/matchmaking';
import { PageContainer, PageHeader, Toolbar } from '@/shared/layout';
import { useSession } from '@/shared/session';
import { Button, ButtonLink, Card, CardSkeleton, EmptyState, ErrorNotice, Segmented, StatusBadge, TimeAgo } from '@/shared/ui';

import { useProjects } from '../api';
import { ProjectCard } from './ProjectCard';

type Tab = 'all' | 'recommended' | 'mine';

export function ProjectsScreen() {
  const { isAuthenticated, profile } = useSession();
  const [tab, setTab] = useState<Tab>(isAuthenticated ? 'recommended' : 'all');
  const recommended = useRecommendedProjects();
  const applications = useMyApplications();

  return (
    <PageContainer>
      <PageHeader
        icon={<FolderGit2 aria-hidden />}
        title="Projets"
        description="Des bibliothèques open source pensées pour les contraintes du continent, qui cherchent des contributeurs."
        actions={
          <ButtonLink href={isAuthenticated ? '/projects/new' : '/login?next=/projects/new'}>
            <Plus className="size-4" aria-hidden /> Proposer un projet
          </ButtonLink>
        }
      />
      {isAuthenticated ? (
        <Toolbar className="mb-4">
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'recommended', label: 'Pour vous', icon: <Sparkles aria-hidden />, count: recommended.data?.length },
              { value: 'all', label: 'Tous les projets', icon: <Layers aria-hidden /> },
              { value: 'mine', label: 'Mes contributions', icon: <GitPullRequest aria-hidden />, count: applications.data?.length },
            ]}
          />
        </Toolbar>
      ) : null}

      {tab === 'recommended' ? (
        <section className="space-y-4">
          {profile && !profile.stack.length ? (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-body-md text-ink">Renseignez votre stack technique pour recevoir des recommandations.</p>
              <ButtonLink href="/profile" size="sm">Compléter mon profil</ButtonLink>
            </Card>
          ) : null}
          {recommended.data?.length ? (
            <Card className="flex flex-wrap items-center gap-3 border-primary/25 bg-primary-soft/40 p-4">
              <Sparkles className="size-5 text-primary-ink" aria-hidden />
              <StatusBadge tone="success">Match personnalisé</StatusBadge>
              <p className="text-body-md text-ink">
                Vous maîtrisez <span className="font-mono text-primary-ink">{profile?.stack.slice(0, 4).join(', ')}</span> :{' '}
                {recommended.data.length} projet{recommended.data.length > 1 ? 's' : ''} recherchent vos compétences.
              </p>
            </Card>
          ) : null}
          {recommended.isPending ? (
            <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
          ) : recommended.data?.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {recommended.data.map(({ project, score, matched }) => (
                <ProjectCard key={project.id} project={project} score={score} matched={matched} />
              ))}
            </div>
          ) : profile?.stack.length ? (
            <EmptyState icon={<FolderGit2 className="size-8" aria-hidden />} title="Pas encore de projet correspondant">
              Explorez tous les projets ou proposez le vôtre.
            </EmptyState>
          ) : null}
        </section>
      ) : tab === 'mine' ? (
        <section className="space-y-3">
          {applications.data?.length ? (
            applications.data.map((application) => (
              <Card key={application.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/projects/${application.project_id}`} className="font-semibold text-ink hover:underline">
                    Voir le projet
                  </Link>
                  <p className="text-label-md text-ink-muted">
                    Candidature <TimeAgo date={application.created_at} />
                  </p>
                </div>
                <StatusBadge tone={application.status === 'accepted' ? 'success' : application.status === 'declined' ? 'neutral' : 'warning'}>
                  {{ pending: 'En attente', accepted: 'Acceptée', declined: 'Déclinée' }[application.status]}
                </StatusBadge>
              </Card>
            ))
          ) : (
            <EmptyState title="Aucune contribution en cours">
              Proposez votre aide sur un projet : son porteur sera prévenu tout de suite.
            </EmptyState>
          )}
        </section>
      ) : (
        <AllProjects />
      )}
    </PageContainer>
  );
}

function AllProjects() {
  const projects = useProjects();
  if (projects.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
    );
  }
  if (projects.isError && !projects.items.length) {
    return <ErrorNotice message="Les projets s'afficheront dès le retour du réseau." />;
  }
  if (!projects.items.length) {
    return (
      <EmptyState icon={<FolderGit2 className="size-8" aria-hidden />} title="Aucun projet pour l'instant" action={<ButtonLink href="/projects/new">Proposer un projet</ButtonLink>}>
        Partagez votre projet open source pour trouver des contributeurs.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.items.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      {projects.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => projects.fetchNextPage()} loading={projects.isFetchingNextPage}>
          Charger plus
        </Button>
      ) : null}
    </div>
  );
}
