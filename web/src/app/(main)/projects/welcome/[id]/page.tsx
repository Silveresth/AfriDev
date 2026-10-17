import type { Metadata } from 'next';

import { WelcomeScreen } from '@/features/matchmaking';
import { RequireAuth } from '@/shared/session';

export const metadata: Metadata = { title: "Bienvenue dans l'équipe", robots: { index: false } };

export default async function WelcomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl">
        <WelcomeScreen applicationId={id} />
      </div>
    </RequireAuth>
  );
}
