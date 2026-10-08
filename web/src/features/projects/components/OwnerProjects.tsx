'use client';

import { CardSkeleton, EmptyState } from '@/shared/ui';

import { useProjects } from '../api';
import { ProjectCard } from './ProjectCard';

/** Projets portés par un membre (onglet du profil). */
export function OwnerProjects({ ownerId }: { ownerId: string }) {
  const projects = useProjects({ owner: ownerId });
  if (projects.isPending) return <CardSkeleton />;
  if (!projects.items.length) return <EmptyState title="Aucun projet open source" />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.items.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
