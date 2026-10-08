'use client';

import { Bot, Check, EyeOff, ExternalLink, RotateCcw, ShieldCheck, Undo2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { PageHeader } from '@/shared/layout';
import { cn } from '@/shared/lib';
import {
  Avatar,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorNotice,
  FilterChips,
  Segmented,
  StatusBadge,
  TimeAgo,
  useToast,
} from '@/shared/ui';

import {
  type ModerationAction,
  type ModerationReport,
  type ReportFilters,
  type ReportStatus,
  useReports,
  useResolveReport,
} from '../api';

const TARGETS = { post: 'Post', comment: 'Commentaire', question: 'Question', answer: 'Réponse' } as const;
const REASONS: Record<string, string> = {
  spam: 'Spam ou publicité',
  abuse: 'Harcèlement ou propos haineux',
  scam: 'Arnaque',
  secret: 'Donnée sensible exposée',
  off_topic: 'Hors sujet',
  other: 'Autre',
};
const CATEGORIES: Record<string, string> = { spam: 'Spam', abuse: 'Harcèlement', scam: 'Arnaque', ok: 'Conforme' };

type TargetFilter = 'all' | keyof typeof TARGETS;
type SourceFilter = 'all' | 'ai' | 'member';

export function ModerationScreen() {
  const [status, setStatus] = useState<ReportStatus>('open');
  const [target, setTarget] = useState<TargetFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const filters: ReportFilters = {
    status,
    target_type: target === 'all' ? undefined : target,
    source: source === 'all' ? undefined : source,
  };
  const reports = useReports(filters);

  return (
    <>
      <PageHeader
        eyebrow="Back-office"
        title="File de modération"
        description="Signalements des membres et de l'analyse automatique. Masquer un contenu prévient son auteur ; un masquage peut toujours être annulé."
      />
      <div className="mb-4 space-y-3">
        <Segmented<ReportStatus>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'À traiter' },
            { value: 'hidden', label: 'Contenus masqués' },
            { value: 'dismissed', label: 'Rejetés' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <FilterChips<TargetFilter>
            value={target}
            onChange={setTarget}
            options={[{ value: 'all', label: 'Tous les contenus' }, ...Object.entries(TARGETS).map(([value, label]) => ({ value: value as TargetFilter, label }))]}
          />
          <FilterChips<SourceFilter>
            value={source}
            onChange={setSource}
            options={[
              { value: 'all', label: 'Toutes origines' },
              { value: 'member', label: 'Membres' },
              { value: 'ai', label: 'IA' },
            ]}
          />
        </div>
      </div>

      {reports.isPending ? (
        <div className="space-y-4">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      ) : reports.isError ? (
        <ErrorNotice title="File indisponible" message={errorMessage(reports.error)} />
      ) : !reports.items.length ? (
        <EmptyState icon={<ShieldCheck className="size-8" aria-hidden />} title={status === 'open' ? 'Rien à traiter' : 'Aucun signalement'}>
          {status === 'open'
            ? 'La file est vide : aucun contenu signalé n’attend de décision.'
            : 'Aucun signalement ne correspond à ces filtres.'}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {groupByTarget(reports.items).map((group) => (
            <li key={group[0]!.id}>
              <ReportCard reports={group} />
            </li>
          ))}
        </ul>
      )}
      {reports.hasNextPage ? (
        <Button variant="ghost" className="mt-4 w-full" onClick={() => reports.fetchNextPage()} loading={reports.isFetchingNextPage}>
          Charger plus
        </Button>
      ) : null}
    </>
  );
}

const CONFIRM: Record<ModerationAction, string> = {
  hide: 'Masquer ce contenu ? Son auteur sera prévenu, et tous ses signalements seront clos.',
  dismiss: 'Rejeter ce signalement ? Le contenu reste visible.',
  restore: 'Rétablir ce contenu ? Il réapparaîtra sur le site.',
};
const DONE: Record<ModerationAction, string> = {
  hide: 'Contenu masqué.',
  dismiss: 'Signalement rejeté.',
  restore: 'Contenu rétabli.',
};

/** Un contenu signalé plusieurs fois = une seule carte : chaque décision s'applique au contenu. */
function groupByTarget(reports: ModerationReport[]): ModerationReport[][] {
  const groups = new Map<string, ModerationReport[]>();
  for (const report of reports) {
    const key = `${report.target_type}:${report.target_id}`;
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }
  return [...groups.values()];
}

function ReportCard({ reports }: { reports: ModerationReport[] }) {
  const toast = useToast();
  const resolve = useResolveReport();
  const [expanded, setExpanded] = useState(false);
  const report = reports[0]!;
  const content = report.content;
  const verdict = reports.find((item) => item.ai_verdict)?.ai_verdict ?? null;
  const reasons = [...new Set(reports.map((item) => item.reason))];
  // Le commentaire d'un signalement de l'IA reprend son avis, déjà affiché plus bas.
  const details = reports.filter((item) => item.details && item.reporter);
  const reporters = reports.map((item) => (item.reporter ? `@${item.reporter.username}` : 'Analyse automatique'));
  const count = Math.max(report.report_count, reports.length);
  const long = (content?.text.length ?? 0) > 280;

  const act = (action: ModerationAction) => {
    if (!window.confirm(CONFIRM[action])) return;
    resolve.mutate(
      { id: report.id, action },
      {
        onSuccess: () => toast(DONE[action]),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    );
  };

  return (
    <Card className={cn('space-y-4 p-4 sm:p-5', report.status === 'open' && 'border-l-[3px] border-l-primary')}>
      <header className="flex flex-wrap items-center gap-2">
        <StatusBadge dot={false}>{TARGETS[report.target_type]}</StatusBadge>
        {reasons.map((reason) => (
          <StatusBadge key={reason} tone="warning" dot={false}>{REASONS[reason] ?? reason}</StatusBadge>
        ))}
        {count > 1 ? <StatusBadge tone="danger">Signalé {count} fois</StatusBadge> : null}
        <span className="ml-auto flex items-center gap-1.5 text-label-md text-ink-faint">
          {report.reporter ? <UserRound className="size-3.5" aria-hidden /> : <Bot className="size-3.5" aria-hidden />}
          {reporters.join(', ')} · <TimeAgo date={report.created_at} />
        </span>
      </header>

      {content ? (
        <div className={cn('space-y-3 rounded-lg border p-3', content.hidden ? 'border-dashed border-danger/40 bg-danger-soft/30' : 'border-line bg-container-low')}>
          <div className="flex flex-wrap items-center gap-2">
            <Avatar name={content.author?.display_name ?? '?'} src={content.author?.avatar_url} size={28} />
            {content.author ? (
              <Link href={`/u/${content.author.username}`} className="text-body-sm font-semibold text-ink hover:underline">
                {content.author.display_name}
              </Link>
            ) : (
              <span className="text-body-sm text-ink-muted">Auteur inconnu</span>
            )}
            {content.hidden ? (
              <StatusBadge tone="danger" dot={false}>
                <EyeOff className="size-3" aria-hidden /> Masqué sur le site
              </StatusBadge>
            ) : (
              <Link href={content.url} target="_blank" className="ml-auto inline-flex items-center gap-1 text-body-sm text-primary-ink hover:underline">
                Voir sur le site <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
          <p className={cn('whitespace-pre-wrap break-words text-body-md text-ink', !expanded && long && 'line-clamp-5')}>{content.text}</p>
          {long ? (
            <button type="button" onClick={() => setExpanded(!expanded)} className="text-body-sm text-primary-ink hover:underline">
              {expanded ? 'Réduire' : 'Lire tout'}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line-strong p-3 text-body-sm text-ink-muted">
          Contenu supprimé par son auteur.
        </p>
      )}

      {details.map((item) => (
        <blockquote key={item.id} className="border-l-2 border-line-strong pl-3 text-body-sm text-ink-muted">
          « {item.details} »
          <span className="ml-2 text-label-md text-ink-faint">
            {item.reporter ? `@${item.reporter.username}` : 'IA'}
          </span>
        </blockquote>
      ))}

      {verdict ? <Verdict verdict={verdict} /> : null}

      <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {report.status === 'open' ? (
          <>
            <Button variant="danger" size="sm" onClick={() => act('hide')} loading={resolve.isPending && resolve.variables?.action === 'hide'}>
              <EyeOff className="size-4" aria-hidden /> Masquer le contenu
            </Button>
            <Button variant="ghost" size="sm" onClick={() => act('dismiss')} loading={resolve.isPending && resolve.variables?.action === 'dismiss'}>
              <Check className="size-4" aria-hidden /> Rejeter le signalement
            </Button>
          </>
        ) : report.status === 'hidden' ? (
          <Button variant="ghost" size="sm" onClick={() => act('restore')} loading={resolve.isPending}>
            <Undo2 className="size-4" aria-hidden /> Rétablir le contenu
          </Button>
        ) : (
          <StatusBadge dot={false}>
            <RotateCcw className="size-3" aria-hidden /> Contenu laissé visible
          </StatusBadge>
        )}
        {report.resolved_at ? (
          <span className="ml-auto text-label-md text-ink-faint">
            Traité {report.resolved_by ? `par @${report.resolved_by.username} ` : 'automatiquement '}
            <TimeAgo date={report.resolved_at} />
          </span>
        ) : null}
      </footer>
    </Card>
  );
}

function Verdict({ verdict }: { verdict: NonNullable<ModerationReport['ai_verdict']> }) {
  const percent = Math.round(verdict.confidence * 100);
  return (
    <div className="space-y-2 rounded-lg border border-secondary/30 bg-secondary-soft/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Bot className="size-4 text-secondary-ink" aria-hidden />
        <span className="text-body-sm font-semibold text-on-secondary-soft">Avis de l&apos;IA</span>
        <StatusBadge tone={verdict.violates ? 'danger' : 'success'} dot={false}>
          {verdict.violates ? `Infraction probable : ${CATEGORIES[verdict.category] ?? verdict.category}` : 'Conforme'}
        </StatusBadge>
        <span className="ml-auto text-label-md text-ink-muted">Confiance {percent} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-container-high" aria-hidden>
        <div className={cn('h-full', verdict.violates ? 'bg-danger' : 'bg-secondary')} style={{ width: `${percent}%` }} />
      </div>
      {verdict.explanation ? <p className="text-body-sm text-ink">{verdict.explanation}</p> : null}
      <p className="text-label-md text-ink-faint">Indicatif : la décision revient à l&apos;équipe.</p>
    </div>
  );
}
