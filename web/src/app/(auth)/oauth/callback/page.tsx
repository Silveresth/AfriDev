import type { Metadata } from 'next';
import { Suspense } from 'react';

import { OAuthCallback } from '@/features/auth';

export const metadata: Metadata = { title: 'Connexion', robots: { index: false } };

export default function OAuthCallbackPage() {
  return (
    <div className="pt-12">
      <Suspense>
        <OAuthCallback />
      </Suspense>
    </div>
  );
}
