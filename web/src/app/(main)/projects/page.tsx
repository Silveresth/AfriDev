import type { Metadata } from 'next';

import { ProjectsScreen } from '@/features/projects';

export const metadata: Metadata = {
  title: 'Projets open source',
  description: "Projets open source d'Afrique qui cherchent des contributeurs, avec leurs good first issues.",
};

export default function ProjectsPage() {
  return <ProjectsScreen />;
}
