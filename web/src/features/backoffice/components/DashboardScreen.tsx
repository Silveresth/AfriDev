'use client';

import {
  Bot,
  CloudOff,
  FolderGit2,
  MessageCircleQuestion,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { PageHeader } from '@/shared/layout';
import { cn, formatCount, plural } from '@/shared/lib';
import { Avatar, ButtonLink, Card, CardHeader, CardSkeleton, ErrorNotice, Segmented, StatusBadge, TimeAgo } from '@/shared/ui';

import { type Dashboard, type Period, useDashboard } from '../api';
import { Breakdown, StackedBars } from './charts';

const REASONS: Record<string, string> = {
  spam: 'Spam ou publicité',
  abuse: 'Harcèlement',
  scam: 'Arnaque',
  secret: 'Donnée sensible',
  off_topic: 'Hors sujet',
  other: 'Autre',
};

export function DashboardScreen() {
  const [days, setDays] = useState<Period>(30);
  const dashboard = useDashboard(days);

  return (
    <>
      <PageHeader
        eyebrow="Back-office"
        title="Tableau de bord"
        description="Santé de la communauté, file de modération et consommation de l'IA."
        actions={
          <Segmented<`${Period}`>
            value={`${days}`}
            onChange={(value) => setDays(Number(value) as Period)}
            options={[
              { value: '7', label: '7 jours' },
              { value: '30', label: '30 jours' },
              { value: '90', label: '90 jours' },
            ]}
          />
        }
      />
      {dashboard.data ? (
        <div className={cn('space-y-6 transition-opacity', dashboard.isPlaceholderData && 'opacity-60')}>
          <Kpis data={dashboard.data} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Activity data={dashboard.data} />
            <Moderation data={dashboard.data} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Unanswered data={dashboard.data} />
            <Ai data={dashboard.data} />
            <Content data={dashboard.data} />
          </div>
          <p className="text-label-md text-ink-faint">
            Mis à jour <TimeAgo date={dashboard.data.generated_at} /> · actualisation automatique chaque minute
          </p>
        </div>
      ) : dashboard.isError ? (
        <ErrorNotice title="Tableau de bord indisponible" message="Le serveur ne répond pas. Réessayez dans un instant." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      )}
    </>
  );
}

function Kpi({
  icon,
  label,
  value,
  detail,
  href,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: React.ReactNode;
  href?: string;
  alert?: boolean;
}) {
  const body = (
    <Card className={cn('h-full space-y-2 p-4 transition-colors', href && 'hover:border-primary', alert && 'border-primary bg-primary-soft/30')}>
      <p className="flex items-center gap-2 text-label-md font-bold tracking-wide uppercase text-ink-muted">
        {icon} {label}
      </p>
      <p className="text-headline-xl text-ink">{formatCount(value)}</p>
      <p className="text-body-sm text-ink-muted">{detail}</p>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Kpis({ data }: { data: Dashboard }) {
  const { members, content, moderation } = data;
  const contributions =
    content.posts.new + content.comments.new + content.qa.new_questions + content.qa.new_answers;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        icon={<Users className="size-4" aria-hidden />}
        label="Membres"
        value={members.total}
        href="/admin/members"
        detail={
          <>
            <span className="font-semibold text-secondary-ink">+{members.new}</span> {members.new > 1 ? 'inscrits' : 'inscrit'} · {plural(members.active, 'connecté')} sur la période
          </>
        }
      />
      <Kpi
        icon={<TrendingUp className="size-4" aria-hidden />}
        label="Contributions"
        value={contributions}
        detail={[plural(content.posts.new, 'post'), plural(content.comments.new, 'commentaire'), plural(content.qa.new_questions, 'question'), plural(content.qa.new_answers, 'réponse')].join(', ')}
      />
      <Kpi
        icon={<ShieldAlert className="size-4" aria-hidden />}
        label="À modérer"
        value={moderation.open}
        href="/admin/moderation"
        alert={moderation.open > 0}
        detail={`${plural(moderation.new, 'signalement')} sur la période, dont ${moderation.new_from_ai} par l'IA`}
      />
      <Kpi
        icon={<MessageCircleQuestion className="size-4" aria-hidden />}
        label="Sans réponse"
        value={content.qa.unanswered}
        detail={`${plural(content.qa.resolved, 'question résolue', 'questions résolues')} sur ${content.qa.questions}`}
      />
    </div>
  );
}

function Activity({ data }: { data: Dashboard }) {
  return (
    <Card className="space-y-6 p-4 sm:p-6">
      <CardHeader icon={<TrendingUp className="size-5" aria-hidden />} title="Activité" subtitle={`Sur ${data.period_days} jours`} />
      <StackedBars
        title="Contributions par jour"
        data={data.timeline}
        series={[
          { key: 'posts', label: 'Posts', fill: 'fill-primary', dot: 'bg-primary' },
          { key: 'comments', label: 'Commentaires', fill: 'fill-tertiary', dot: 'bg-tertiary' },
          { key: 'qa', label: 'Questions & réponses', fill: 'fill-secondary', dot: 'bg-secondary' },
        ]}
      />
      <StackedBars
        title="Inscriptions par jour"
        data={data.timeline}
        height={90}
        series={[{ key: 'signups', label: 'Inscriptions', fill: 'fill-secondary', dot: 'bg-secondary' }]}
      />
    </Card>
  );
}

function Moderation({ data }: { data: Dashboard }) {
  const { moderation, sync } = data;
  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <CardHeader
        icon={<ShieldAlert className="size-5" aria-hidden />}
        title="Modération"
        action={<ButtonLink href="/admin/moderation" size="sm">Ouvrir la file</ButtonLink>}
      />
      <div className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['open', 'À traiter', 'text-primary-ink'],
            ['hidden', 'Masqués', 'text-danger'],
            ['dismissed', 'Rejetés', 'text-ink-muted'],
          ] as const
        ).map(([key, label, color]) => (
          <div key={key} className="rounded-lg border border-line bg-container-low p-2">
            <p className={cn('text-headline-md', color)}>{moderation.by_status[key] ?? 0}</p>
            <p className="text-label-md text-ink-muted">{label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-label-md font-bold tracking-wide uppercase text-ink-muted">Motifs sur la période</p>
        <Breakdown
          items={Object.entries(moderation.by_reason)
            .sort((a, b) => b[1] - a[1])
            .map(([reason, value]) => ({ label: REASONS[reason] ?? reason, value, tone: 'tertiary' as const }))}
          empty="Aucun signalement sur la période."
        />
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-line bg-container-low p-3">
        <CloudOff className="mt-0.5 size-4 shrink-0 text-offline" aria-hidden />
        <p className="text-body-sm text-ink-muted">
          <span className="font-semibold text-ink">{sync.new}</span> {sync.new > 1 ? 'envois hors ligne refusés' : 'envoi hors ligne refusé'} par le serveur sur la
          période, dont {sync.unacknowledged} pas encore vus par leur auteur.
        </p>
      </div>
    </Card>
  );
}

function Unanswered({ data }: { data: Dashboard }) {
  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <CardHeader
        icon={<MessageCircleQuestion className="size-5" aria-hidden />}
        title="Questions en attente"
        subtitle="Les plus anciennes sans réponse"
      />
      {data.unanswered_questions.length ? (
        <ul className="space-y-2">
          {data.unanswered_questions.map((question) => (
            <li key={question.id}>
              <Link
                href={`/questions/${question.id}`}
                className="flex items-start gap-3 rounded-lg border border-line bg-container-low p-3 hover:border-primary"
              >
                <Avatar name={question.author?.display_name ?? '?'} src={question.author?.avatar_url} size={28} />
                <span className="min-w-0">
                  <span className="block text-body-sm font-semibold text-ink">{question.title}</span>
                  <TimeAgo date={question.created_at} className="text-label-md text-ink-faint" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-ink-muted">Toutes les questions ont reçu au moins une réponse.</p>
      )}
    </Card>
  );
}

const AI_STATUS: Record<string, { label: string; tone: 'secondary' | 'tertiary' | 'danger' | 'neutral' }> = {
  ready: { label: 'Réponses générées', tone: 'secondary' },
  pending: { label: 'En cours', tone: 'tertiary' },
  failed: { label: 'Échecs', tone: 'danger' },
  disabled: { label: 'IA désactivée', tone: 'neutral' },
};

function Ai({ data }: { data: Dashboard }) {
  const { ai } = data;
  const { usage } = ai;
  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <CardHeader icon={<Sparkles className="size-5" aria-hidden />} title="Assistant IA (Groq)" />
      <Breakdown
        items={Object.entries(AI_STATUS).map(([status, meta]) => ({
          label: meta.label,
          value: ai.answers[status] ?? 0,
          tone: meta.tone,
        }))}
        empty="Aucune question pour l'instant."
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-line bg-container-low p-3">
          <p className="text-headline-md">{ai.translations}</p>
          <p className="text-label-md text-ink-muted">traductions</p>
        </div>
        <div className="rounded-lg border border-line bg-container-low p-3">
          <p className="text-headline-md">{ai.guides.new}</p>
          <p className="text-label-md text-ink-muted">
            guides{ai.guides.failed ? ` · ${ai.guides.failed} échecs` : ''}
          </p>
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-line bg-container-low p-3">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Bot className="size-4 text-primary-ink" aria-hidden /> Jetons consommés
        </p>
        <p className="font-mono text-body-sm text-ink">
          {formatCount(usage.input_tokens)} en entrée · {formatCount(usage.output_tokens)} en sortie
        </p>
        {usage.by_model.length ? (
          <ul className="space-y-1">
            {usage.by_model.map((model) => (
              <li key={model.model} className="flex justify-between gap-2 text-label-md text-ink-muted">
                <span className="truncate">{model.model}</span>
                <span>{formatCount(model.input + model.output)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-ink-muted">Aucun appel à Groq enregistré sur la période.</p>
        )}
        {usage.days_covered < data.period_days ? (
          <p className="text-label-md text-ink-faint">Compteurs conservés {usage.days_covered} jours.</p>
        ) : null}
      </div>
    </Card>
  );
}

function Content({ data }: { data: Dashboard }) {
  const { posts, snippets, projects, applications } = data.content;
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Posts', value: `${posts.total} (+${posts.new})` },
    { label: 'dont sondages / vidéos', value: `${posts.by_kind.poll ?? 0} / ${posts.by_kind.short ?? 0}` },
    { label: 'Snippets publics', value: `${snippets.public} sur ${snippets.total}` },
    {
      label: 'Snippets bloqués (Security Guard)',
      value: snippets.flagged ? <StatusBadge tone="danger">{snippets.flagged}</StatusBadge> : '0',
    },
    { label: 'Projets qui recrutent', value: `${projects.recruiting} sur ${projects.total}` },
    {
      label: 'Erreurs de synchro GitHub',
      value: projects.sync_errors ? <StatusBadge tone="warning">{projects.sync_errors}</StatusBadge> : '0',
    },
    {
      label: 'Candidatures (période)',
      value: `${applications.new} · ${applications.by_status.accepted ?? 0} acceptées`,
    },
  ];
  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <CardHeader icon={<FolderGit2 className="size-5" aria-hidden />} title="Contenus" />
      <dl className="divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2 text-body-sm">
            <dt className="text-ink-muted">{row.label}</dt>
            <dd className="font-mono text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
