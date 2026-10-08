import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MyProfileRedirect } from '@/features/profile';
import { RequireAuth } from '@/shared/session';

export const metadata: Metadata = { title: 'Mon profil' };

export default function MyProfilePage() {
  return (
    <RequireAuth>
      <Suspense>
        <MyProfileRedirect />
      </Suspense>
    </RequireAuth>
  );
}
