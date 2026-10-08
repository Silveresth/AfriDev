'use client';

import { Check, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { Button, useToast } from '@/shared/ui';

import { type Hub, useJoinHub } from '../api';

/** « Rejoindre » / « Membre » (survol : « Quitter »). Non connecté : vers la connexion. */
export function JoinButton({ hub, size = 'sm', className }: { hub: Hub; size?: 'sm' | 'md'; className?: string }) {
  const { isAuthenticated, user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const join = useJoinHub(hub);
  const [hover, setHover] = useState(false);
  const member = Boolean(hub.viewer?.is_member);
  const isCreator = Boolean(user && hub.creator?.id === user.id);

  async function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`/h/${hub.slug}`)}`);
      return;
    }
    try {
      await join.mutateAsync(!member);
      toast(member ? `Vous avez quitté h/${hub.slug}.` : `Bienvenue dans h/${hub.slug} !`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  if (member) {
    return (
      <Button
        variant="outline"
        size={size}
        className={className}
        loading={join.isPending}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={toggle}
        disabled={isCreator}
        title={isCreator ? 'Le créateur ne peut pas quitter son hub' : undefined}
      >
        {hover && !isCreator ? 'Quitter' : (
          <>
            <Check className="size-4" aria-hidden /> Membre
          </>
        )}
      </Button>
    );
  }
  return (
    <Button size={size} className={className} loading={join.isPending} onClick={toggle}>
      <Plus className="size-4" aria-hidden /> Rejoindre
    </Button>
  );
}
