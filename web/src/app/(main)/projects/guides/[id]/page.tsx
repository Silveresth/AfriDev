import type { Metadata } from 'next';

import { GuideScreen } from '@/features/onboarding-agent';
import { RequireAuth } from '@/shared/session';

export const metadata: Metadata = { title: 'Guide de démarrage' };

export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl">
        <GuideScreen id={id} />
      </div>
    </RequireAuth>
  );
}
