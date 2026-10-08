'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { useSession } from '@/shared/session';
import { CardSkeleton } from '@/shared/ui';

/** /profile -> /u/<mon pseudo> (en gardant ?welcome=1 après l'inscription). */
export function MyProfileRedirect() {
  const { profile } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (profile) router.replace(`/u/${profile.username}${params.get('welcome') ? '?welcome=1' : ''}`);
  }, [profile, router, params]);
  return <CardSkeleton lines={4} />;
}
