import type { Schemas } from '@afridev/api-client';
import type { Metadata } from 'next';

import { ProjectDetail } from '@/features/projects';
import { serverGet } from '@/shared/api/server';

type Props = { params: Promise<{ id: string }> };

const getProject = (id: string) => serverGet<Schemas['ProjectOutput']>(`/api/projects/${encodeURIComponent(id)}/`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).id);
  if (!project) return { title: 'Projet' };
  return { title: project.name, description: project.description.slice(0, 160) };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const project = await getProject(id);
  return <ProjectDetail id={id} initial={project ?? undefined} />;
}
