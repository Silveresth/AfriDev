'use client';

import { GitPullRequest, MessagesSquare, TrendingUp } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Tabs } from '@/shared/ui';

import { AskPanel } from './AskPanel';
import { FirstContributionsPanel } from './FirstContributionsPanel';
import { ProfileReviewPanel } from './ProfileReviewPanel';

type Tool = 'ask' | 'profile' | 'contribute';
const TOOLS: Tool[] = ['ask', 'profile', 'contribute'];

/** /assistant : « Demande à AfriDev », analyse du profil, premières contributions (?tab=…). */
export function AssistantScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get('tab') as Tool | null;
  const tool: Tool = requested && TOOLS.includes(requested) ? requested : 'ask';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header>
        <h1 className="text-headline-xl text-ink">Assistant IA</h1>
        <p className="text-body-md text-ink-muted">Des réponses tirées de la communauté, des conseils pour votre profil et des tâches open source à votre portée.</p>
      </header>
      <Tabs<Tool>
        value={tool}
        onChange={(value) => router.replace(value === 'ask' ? '/assistant' : `/assistant?tab=${value}`, { scroll: false })}
        options={[
          { value: 'ask', label: 'Demander à AfriDev', icon: <MessagesSquare className="size-4" aria-hidden /> },
          { value: 'profile', label: 'Mon profil', icon: <TrendingUp className="size-4" aria-hidden /> },
          { value: 'contribute', label: 'Contribuer', icon: <GitPullRequest className="size-4" aria-hidden /> },
        ]}
      />
      {tool === 'ask' ? <AskPanel /> : tool === 'profile' ? <ProfileReviewPanel /> : <FirstContributionsPanel />}
    </div>
  );
}
