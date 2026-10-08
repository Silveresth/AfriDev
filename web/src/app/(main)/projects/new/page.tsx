import type { Metadata } from 'next';

import { ProjectFormScreen } from '@/features/projects';
import { RequireAuth } from '@/shared/session';

export const metadata: Metadata = { title: 'Proposer un projet' };

export default function NewProjectPage() {
  return (
    <RequireAuth>
      <ProjectFormScreen />
    </RequireAuth>
  );
}
