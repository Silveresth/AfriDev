'use client';

import { Sun } from 'lucide-react';
import Link from 'next/link';

import { useSession } from '@/shared/session';
import { Skeleton, SideCard } from '@/shared/ui';

import { useDigest } from '../api';

/** « 5 min de lecture » : le résumé IA du jour (offres, questions, posts, messages, abonnés). */
export function DigestCard() {
  const { isAuthenticated } = useSession();
  const digest = useDigest();
  if (!isAuthenticated || digest.isError || (digest.isSuccess && !digest.data)) return null;
  return (
    <SideCard title={digest.data?.headline ?? 'Votre résumé du jour'} icon={<Sun aria-hidden />}>
      {digest.isPending ? (
        <div className="space-y-2 px-4 pb-4">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-9/12" />
          <Skeleton className="h-4 w-10/12" />
        </div>
      ) : (
        <ul className="space-y-1 px-2 pb-3">
          {digest.data?.items.map((item, index) => {
            const content = (
              <>
                <span className="shrink-0" aria-hidden>
                  {item.emoji}
                </span>
                <span>{item.text}</span>
              </>
            );
            return (
              <li key={index}>
                {item.url ? (
                  <Link href={item.url} className="flex gap-2.5 rounded-lg px-2 py-1.5 text-body-sm text-ink hover:bg-container">
                    {content}
                  </Link>
                ) : (
                  <p className="flex gap-2.5 px-2 py-1.5 text-body-sm text-ink">{content}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SideCard>
  );
}
