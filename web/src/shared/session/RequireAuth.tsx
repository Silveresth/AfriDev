'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useIsClient } from '@/shared/hooks';

import { useSession } from './SessionProvider';

/**
 * Réservé aux membres connectés : sinon redirige vers la connexion, puis revient ici.
 * Le jeton vit dans le navigateur : rien n'est rendu côté serveur pour une page privée.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useSession();
  const isClient = useIsClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isClient && !isAuthenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isClient, isAuthenticated, pathname, router]);

  if (!isClient || !isAuthenticated) return null;
  return <>{children}</>;
}