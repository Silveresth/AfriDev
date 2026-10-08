'use client';

import { Bot, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { Button, ButtonLink, CardSkeleton, Markdown, StatusBadge, TimeAgo } from '@/shared/ui';

import { type Guide, useGuide, useProjectGuides, useRequestGuide } from '../api';

/** Bouton « Guide de démarrage IA » d'un projet, et le guide une fois rédigé. */
export function ProjectGuide({ projectId, repoUrl }: { projectId: string; repoUrl: string }) {
  const { isAuthenticated } = useSession();
  const existing = useProjectGuides(projectId);
  const request = useRequestGuide();
  const [guideId, setGuideId] = useState<string | null>(null);
  const current = useGuide(guideId ?? existing.data?.[0]?.id ?? null);

  if (!repoUrl) {
    return <p className="text-body-sm text-ink-muted">Ajoutez le dépôt GitHub du projet pour générer un guide de démarrage.</p>;
  }

  const start = async () => {
    const guide = await request.mutateAsync({ repo_url: repoUrl, project_id: projectId });
    setGuideId(guide.id);
  };

  if (!current.data) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl bg-container-low p-4">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Bot className="size-5 text-primary-ink" aria-hidden /> Guide de démarrage IA
        </p>
        <p className="text-body-sm text-ink-muted">
          L&apos;agent lit le dépôt (README, fichiers de configuration, arborescence, good first issues)
          et rédige un guide pour faire votre première contribution.
        </p>
        {isAuthenticated ? (
          <Button onClick={start} loading={request.isPending}>
            <Sparkles className="size-4" aria-hidden /> Générer le guide
          </Button>
        ) : (
          <ButtonLink href={`/login?next=/projects/${projectId}`} size="sm">Se connecter pour générer le guide</ButtonLink>
        )}
        {request.isError ? <p className="text-body-sm text-danger">{errorMessage(request.error)}</p> : null}
      </div>
    );
  }
  return <GuideView guide={current.data} onRetry={isAuthenticated ? start : undefined} retrying={request.isPending} />;
}

export function GuideView({ guide, onRetry, retrying }: { guide: Guide; onRetry?: () => void; retrying?: boolean }) {
  return (
    <section className="space-y-4" aria-label="Guide de démarrage">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-headline-md">
            <Bot className="size-5 text-primary-ink" aria-hidden /> Guide de démarrage IA
          </h2>
          <p className="text-label-md text-ink-muted">
            {guide.repo_url.replace('https://github.com/', '')}
            {guide.commit_sha ? ` · commit ${guide.commit_sha.slice(0, 7)}` : ''} · <TimeAgo date={guide.updated_at} />
          </p>
        </div>
        <StatusBadge tone={guide.status === 'ready' ? 'success' : guide.status === 'pending' ? 'warning' : 'danger'}>
          {{ ready: 'Prêt', pending: "L'agent lit le dépôt…", failed: 'Échec' }[guide.status]}
        </StatusBadge>
      </header>
      {guide.status === 'pending' ? (
        <CardSkeleton lines={5} />
      ) : guide.status === 'ready' ? (
        <div className="rounded-xl bg-container-low p-4">
          <Markdown source={guide.content} />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-body-sm text-danger">{guide.error || 'Le guide n’a pas pu être généré.'}</p>
          {onRetry ? (
            <Button variant="ghost" size="sm" onClick={onRetry} loading={retrying}>
              <RefreshCw className="size-4" aria-hidden /> Réessayer
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** Page d'un guide (lien des notifications « Votre guide est prêt »). */
export function GuideScreen({ id }: { id: string }) {
  const guide = useGuide(id);
  if (!guide.data) return <CardSkeleton lines={6} />;
  return <GuideView guide={guide.data} />;
}
