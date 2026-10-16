'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import { useSession } from '@/shared/session';
import { Button, Card } from '@/shared/ui';

import { OnboardingWizard } from './OnboardingWizard';

const LABELS: Record<string, string> = {
  post: 'Posts',
  question: 'Entraide',
  snippet: 'Snippets',
  project: 'Projets',
  job: 'Offres',
  event: 'Événements',
  news: 'Actu tech',
  video: 'Vidéos',
};

/** Réglages : composition actuelle du fil « Pour vous » et accès à l'assistant pour la modifier. */
export function FeedPreferencesCard() {
  const { profile } = useSession();
  const [open, setOpen] = useState(false);
  if (!profile) return null;
  const mix = Object.entries(profile.feed_mix ?? {}).slice(0, 4);
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-headline-md text-ink">
            <SlidersHorizontal className="size-5 text-ink-faint" aria-hidden /> Mon fil « Pour vous »
          </h2>
          <p className="text-body-sm text-ink-muted">Niveau, objectifs, thématiques et stack suivis.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Modifier
        </Button>
      </div>
      {mix.length ? (
        <p className="text-body-sm text-ink-muted">
          {mix.map(([kind, share]) => `${LABELS[kind] ?? kind} ${share} %`).join(' · ')}
          {profile.interests.length ? ` — ${profile.interests.slice(0, 6).join(', ')}` : ''}
        </p>
      ) : null}
      {open ? <OnboardingWizard name={profile.display_name || profile.username} onDone={() => setOpen(false)} /> : null}
    </Card>
  );
}
