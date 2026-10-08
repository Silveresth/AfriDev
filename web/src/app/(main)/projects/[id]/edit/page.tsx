import type { Metadata } from 'next';

import { ProjectFormScreen } from '@/features/projects';
import { RequireAuth } from '@/shared/session';

export const metadata: Metadata = { title: 'Modifier le projet' };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <ProjectFormScreen id={id} />
    </RequireAuth>
  );
}
