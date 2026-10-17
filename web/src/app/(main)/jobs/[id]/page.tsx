import type { Schemas } from '@afridev/api-client';
import type { Metadata } from 'next';

import { JobDetail } from '@/features/jobs-events';
import { serverGet } from '@/shared/api/server';

type Props = { params: Promise<{ id: string }> };

const getJob = (id: string) => serverGet<Schemas['JobOutput']>(`/api/job-board/${encodeURIComponent(id)}/`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await getJob((await params).id);
  if (!job) return { title: 'Offre d’emploi' };
  return { title: `${job.title} — ${job.company}`, description: job.description.slice(0, 160) };
}

export default async function JobPage({ params }: Props) {
  const { id } = await params;
  const job = await getJob(id);
  return <JobDetail id={id} initial={job ?? undefined} />;
}
