import type { Schemas } from '@afridev/api-client';
import type { Metadata } from 'next';

import { LandingScreen } from '@/features/landing';
import { SESSION_FLAG } from '@/shared/api';
import { serverGet } from '@/shared/api/server';

export const metadata: Metadata = {
  title: { absolute: 'AfriDev — Le réseau d’entraide des développeurs africains' },
  description:
    'Questions et réponses avec l’IA, snippets hors ligne, projets open source africains et opportunités tech. Gratuit, sans publicité, pensé pour les petites connexions.',
};

// Contenu public relu toutes les 5 minutes ; page servie même si l'API ne répond pas.
const REVALIDATE = 300;

/**
 * Un membre déjà connecté va directement sur son fil, avant le premier affichage
 * (« /?apercu » permet de revoir cette page en étant connecté).
 */
const redirectMembers = `try{if(localStorage.getItem('${SESSION_FLAG}')&&!/[?&]apercu/.test(location.search))location.replace('/feed')}catch(e){}`;

export default async function LandingPage() {
  const [hubs, questions, projects] = await Promise.all([
    serverGet<Schemas['PaginatedHubOutputList']>('/api/hubs/?sort=popular&page_size=8', REVALIDATE),
    serverGet<Schemas['PaginatedQuestionOutputList']>('/api/qa/questions/?resolved=false&page_size=5', REVALIDATE),
    serverGet<Schemas['PaginatedProjectOutputList']>('/api/projects/?recruiting=true&page_size=3', REVALIDATE),
  ]);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: redirectMembers }} />
      <LandingScreen
        data={{
          hubs: hubs?.results ?? [],
          questions: questions?.results ?? [],
          projects: projects?.results ?? [],
        }}
      />
    </>
  );
}
