'use client';

import { Briefcase, MessageCircle, MessagesSquare, Sparkles, Sun, TrendingUp, UserPlus } from 'lucide-react';
import Link from 'next/link';

import { useSession } from '@/shared/session';
import { Skeleton, SideCard } from '@/shared/ui';

import { useDigest } from '../api';

/** Icône d'une ligne du résumé, d'après la rubrique visée (plutôt qu'un emoji). */
function DigestIcon({ url }: { url?: string | null }) {
  const path = url ?? '';
  const Icon = path.startsWith('/jobs')
    ? Briefcase
    : path.startsWith('/questions')
      ? MessagesSquare
      : path.startsWith('/profile')
        ? UserPlus
        : path.startsWith('/messages')
          ? MessageCircle
          : path
            ? TrendingUp
            : Sparkles;
  return <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />;
}

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
                <DigestIcon url={item.url} />
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
