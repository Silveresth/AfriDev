'use client';

import { BookOpen, CircleDot, ExternalLink, FolderGit2, GitBranch, Loader2, MessageCircle, PartyPopper, Sparkles, Star, Terminal, Users } from 'lucide-react';
import Link from 'next/link';

import { cn, formatCount } from '@/shared/lib';
import { Avatar, ButtonLink, Card, CardSkeleton, CopyButton, ErrorNotice, LanguageLabel, StatusBadge, Tag } from '@/shared/ui';

import { useWelcome, type Welcome } from '../api';

/**
 * Après une candidature acceptée : les quatre premiers pas d'un contributeur
 * (lire le guide IA, cloner, choisir une issue, se présenter), puis l'équipe.
 */
export function WelcomeScreen({ applicationId }: { applicationId: string }) {
  const welcome = useWelcome(applicationId);
  if (welcome.isPending) return <CardSkeleton lines={8} />;
  if (!welcome.data) {
    return <ErrorNotice title="Espace introuvable" message="Cette candidature n'est pas (encore) acceptée, ou ne vous concerne pas." />;
  }
  return <WelcomeView data={welcome.data} />;
}

function WelcomeView({ data }: { data: Welcome }) {
  const { project, owner } = data;
  const isOwner = data.viewer_role === 'owner';
  const ownerName = owner?.display_name || owner?.username || 'le porteur du projet';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-card sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary-soft text-secondary-ink">
            <PartyPopper className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-label-md font-semibold uppercase tracking-wide text-secondary-ink">{isOwner ? 'Espace du nouveau contributeur' : 'Candidature acceptée'}</p>
            <h1 className="text-headline-xl text-ink">
              {isOwner ? `Onboarding sur ${project.name}` : `Bienvenue dans l'équipe ${project.name}`}
            </h1>
            <p className="max-w-2xl text-body-md text-ink-muted">
              {isOwner
                ? 'Voici ce que voit votre nouveau contributeur : son guide, ses premières tâches et le contact de l’équipe.'
                : `${ownerName} a accepté votre candidature. Quatre étapes pour faire votre première contribution.`}
            </p>
          </div>
          <ButtonLink href={`/projects/${project.id}`} variant="outline">
            <FolderGit2 className="size-4" aria-hidden /> Fiche du projet
          </ButtonLink>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm text-ink-muted">
          {project.language ? <LanguageLabel language={project.language} /> : null}
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 text-tertiary" aria-hidden /> {formatCount(project.stars)}
          </span>
          {project.tags.slice(0, 5).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      </section>

      <ol className="space-y-4">
        <Step n={1} icon={BookOpen} title="Lire le guide de démarrage" done={data.guide?.status === 'ready'}>
          <GuideStep guide={data.guide} hasRepo={Boolean(project.repo_url)} />
        </Step>

        <Step n={2} icon={Terminal} title="Récupérer le code">
          {project.repo_url ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-container-low px-3 py-2 font-mono text-body-sm">
                <span className="min-w-0 flex-1 truncate">git clone {project.repo_url}.git</span>
                <CopyButton text={`git clone ${project.repo_url}.git`} label="Copier" />
              </div>
              <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-body-sm font-semibold text-primary-ink hover:underline">
                Ouvrir le dépôt sur GitHub <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
          ) : (
            <p className="text-body-sm text-ink-muted">Le dépôt n’est pas encore renseigné : demandez l’accès à {ownerName}.</p>
          )}
        </Step>

        <Step n={3} icon={CircleDot} title="Choisir une première tâche">
          {data.issues.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {data.issues.map((issue) => (
                <li key={issue.number} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className="text-body-sm font-semibold text-ink-faint tabular-nums">#{issue.number}</span>
                  <span className="min-w-0 flex-1 text-body-md text-ink">{issue.title}</span>
                  {issue.good_first ? (
                    <StatusBadge tone="success" dot={false}>
                      <Sparkles className="size-3" aria-hidden /> Idéale pour débuter
                    </StatusBadge>
                  ) : null}
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong px-3 text-body-sm font-semibold text-ink hover:bg-container"
                  >
                    Je la prends <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-ink-muted">
              Aucune issue ouverte synchronisée. Demandez à {ownerName} par quoi commencer, ou proposez une amélioration.
            </p>
          )}
          <p className="mt-2 text-label-md text-ink-faint">Laissez un commentaire sur l’issue choisie pour que l’équipe sache que vous vous en occupez.</p>
        </Step>

        <Step n={4} icon={MessageCircle} title="Se présenter à l’équipe">
          {owner ? (
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={ownerName} src={owner.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{ownerName}</p>
                <p className="text-body-sm text-ink-muted">Porteur du projet · @{owner.username}</p>
              </div>
              <ButtonLink href={`/u/${owner.username}`} variant="outline">
                Voir le profil
              </ButtonLink>
            </div>
          ) : null}
        </Step>
      </ol>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-headline-md text-ink">
          <Users className="size-5 text-ink-muted" aria-hidden /> L’équipe ({data.team.length + 1})
        </h2>
        <ul className="flex flex-wrap gap-3">
          {[owner, ...data.team].filter(Boolean).map((member, index) => {
            const name = member!.display_name || member!.username;
            return (
              <li key={member!.id}>
                <Link href={`/u/${member!.username}`} className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 hover:bg-container">
                  <Avatar name={name} src={member!.avatar_url} size={28} />
                  <span className="text-body-sm font-medium text-ink">{name}</span>
                  {index === 0 ? <span className="text-label-md text-ink-faint">porteur</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  done = false,
  children,
}: {
  n: number;
  icon: typeof BookOpen;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-body-sm font-bold',
          done ? 'bg-secondary text-on-secondary' : 'bg-primary-soft text-primary-ink',
        )}
        aria-hidden
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="flex items-center gap-2 text-body-lg font-semibold text-ink">
          <Icon className="size-4 text-ink-muted" aria-hidden /> {title}
        </h2>
        {children}
      </div>
    </li>
  );
}

function GuideStep({ guide, hasRepo }: { guide: Welcome['guide']; hasRepo: boolean }) {
  if (guide?.status === 'ready') {
    return (
      <div className="space-y-2">
        <p className="text-body-sm text-ink-muted">L’IA a lu le dépôt : architecture, installation, conventions et où commencer.</p>
        <ButtonLink href={`/projects/guides/${guide.id}`}>
          <BookOpen className="size-4" aria-hidden /> Ouvrir le guide
        </ButtonLink>
      </div>
    );
  }
  if (guide?.status === 'pending') {
    return (
      <p className="flex items-center gap-2 text-body-sm text-ink-muted" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Le guide est en préparation à partir du code du dépôt (une à deux minutes)…
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-body-sm text-ink-muted">
      <GitBranch className="size-4" aria-hidden />
      {hasRepo ? 'Le guide n’a pas pu être généré : explorez le README du dépôt.' : 'Pas de dépôt GitHub : le guide sera prêt dès qu’il sera renseigné.'}
    </p>
  );
}
