'use client';

import {
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  ExternalLink,
  FolderGit2,
  HandHelping,
  type LucideIcon,
  MapPin,
  MessagesSquare,
  Sparkles,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CardActions } from '@/features/engage';
import { cn, formatCount } from '@/shared/lib';
import { Avatar, CodeBlock, KarmaPill, LanguageLabel, StatusBadge, Tag, TimeAgo } from '@/shared/ui';

import type { HomeItem } from '../api';

type CardType = Exclude<HomeItem['type'], 'post'>;
type Meta = Record<string, string | number | boolean | null | undefined>;

const LOOK: Record<CardType, { label: string; icon: LucideIcon; tone: string; bar: string }> = {
  question: { label: 'Entraide', icon: MessagesSquare, tone: 'bg-secondary-soft text-secondary-ink', bar: 'bg-secondary' },
  snippet: { label: 'Snippet', icon: Code2, tone: 'bg-sky-500/12 text-sky-700 dark:text-sky-300', bar: 'bg-sky-500' },
  project: { label: 'Projet open source', icon: FolderGit2, tone: 'bg-violet-500/12 text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' },
  job: { label: 'Opportunité', icon: BriefcaseBusiness, tone: 'bg-amber-500/14 text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
};

const CONTRACTS: Record<string, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  freelance: 'Freelance',
  stage: 'Stage',
  alternance: 'Alternance',
  temps_partiel: 'Temps partiel',
};

/** Question, snippet, projet ou offre dans le fil d'accueil : même gabarit, accent par type. */
export function HomeCard({ item }: { item: HomeItem }) {
  const router = useRouter();
  const card = item.card;
  if (!card || item.type === 'post') return null;
  const type = item.type as CardType;
  const look = LOOK[type];
  const meta = card.meta as Meta;
  const author = card.author;
  const name = author?.display_name || author?.username || 'Membre';

  return (
    <article
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a, button, pre, input, textarea, form, dialog, [role="menu"]')) return;
        if (window.getSelection()?.toString()) return;
        router.push(card.url);
      }}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-card shadow-card transition-all hover:border-line-strong hover:shadow-raised"
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', look.bar)} aria-hidden />
      <div className="space-y-3 p-4 pb-2 pl-5 sm:p-5 sm:pb-2 sm:pl-6">
        <header className="flex items-center gap-2.5">
          {author ? (
            <Link href={`/u/${author.username}`} className="shrink-0" aria-hidden tabIndex={-1}>
              <Avatar name={name} src={author.avatar_url} size={32} />
            </Link>
          ) : (
            <Avatar name={name} size={32} />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-body-sm">
              {author ? (
                <Link href={`/u/${author.username}`} className="truncate font-semibold text-ink hover:underline">
                  {name}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{name}</span>
              )}
              {author?.karma ? <KarmaPill karma={author.karma} className="text-[0.6875rem]" /> : null}
            </p>
            <TimeAgo date={item.created_at} className="text-label-md text-ink-faint" />
          </div>
          <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-label-md font-semibold', look.tone)}>
            <look.icon className="size-3.5" aria-hidden /> {look.label}
          </span>
        </header>

        <div className="space-y-1.5">
          <h3 className="text-headline-md leading-snug text-ink group-hover:text-primary-ink">
            <Link href={card.url}>{type === 'job' ? `${card.title} · ${meta.company}` : card.title}</Link>
          </h3>
          {type === 'snippet' ? null : card.excerpt ? <p className="line-clamp-2 text-body-md text-ink-muted">{card.excerpt}</p> : null}
        </div>

        {type === 'snippet' && card.excerpt ? (
          <CodeBlock code={card.excerpt} language={String(meta.language ?? '')} maxHeight={200} lineNumbers={false} />
        ) : null}

        <TypeFacts type={type} meta={meta} />

        <footer className="flex flex-wrap items-center gap-1.5">
          {item.matched_tags.length ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-md bg-primary-soft px-1.5 text-label-md font-medium text-primary-ink" title="Correspond à vos centres d'intérêt">
              <Sparkles className="size-3" aria-hidden /> Pour vous
            </span>
          ) : null}
          {card.tags.slice(0, 4).map((tag) => (
            <Tag key={tag} href={`/?tag=${encodeURIComponent(tag)}`}>
              {tag}
            </Tag>
          ))}
          <TypeAction type={type} meta={meta} url={card.url} />
        </footer>
      </div>
      <CardActions item={item} />
    </article>
  );
}

function TypeFacts({ type, meta }: { type: CardType; meta: Meta }) {
  const facts: React.ReactNode[] = [];
  if (type === 'question') {
    facts.push(
      meta.is_resolved ? (
        <StatusBadge key="r" tone="success">
          <CheckCircle2 className="size-3" aria-hidden /> Résolue
        </StatusBadge>
      ) : (
        <StatusBadge key="r" tone="warning">
          En attente d&apos;aide
        </StatusBadge>
      ),
      <span key="a">{formatCount(Number(meta.answer_count ?? 0))} réponse(s)</span>,
    );
  } else if (type === 'snippet') {
    facts.push(<LanguageLabel key="l" language={String(meta.language ?? '')} />, <span key="n">{formatCount(Number(meta.lines ?? 0))} lignes</span>);
  } else if (type === 'project') {
    if (meta.language) facts.push(<LanguageLabel key="l" language={String(meta.language)} />);
    facts.push(
      <span key="s" className="inline-flex items-center gap-1">
        <Star className="size-3.5 text-tertiary" aria-hidden /> {formatCount(Number(meta.stars ?? 0))}
      </span>,
    );
    if (meta.is_recruiting) facts.push(<StatusBadge key="rec" tone="success">Recrute des contributeurs</StatusBadge>);
  } else {
    if (meta.location || meta.is_remote) {
      facts.push(
        <span key="loc" className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden /> {[meta.location, meta.is_remote ? 'Télétravail' : null].filter(Boolean).join(' · ')}
        </span>,
      );
    }
    if (meta.contract_type) facts.push(<StatusBadge key="c">{CONTRACTS[String(meta.contract_type)] ?? String(meta.contract_type)}</StatusBadge>);
    if (meta.salary_range) facts.push(<span key="sal" className="font-medium text-ink">{String(meta.salary_range)}</span>);
  }
  if (!facts.length) return null;
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-body-sm text-ink-muted">{facts}</div>;
}

function TypeAction({ type, meta, url }: { type: CardType; meta: Meta; url: string }) {
  const className =
    'ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-body-sm font-semibold text-ink transition-colors hover:bg-container';
  if (type === 'job' && meta.apply_url) {
    const href = String(meta.apply_url);
    const external = /^https?:\/\//.test(href);
    return (
      <a href={external ? href : `mailto:${href}`} target="_blank" rel="noopener noreferrer nofollow" className={className}>
        Postuler <ExternalLink className="size-3.5" aria-hidden />
      </a>
    );
  }
  if (type === 'question' && !meta.is_resolved) {
    return (
      <Link href={url} className={className}>
        <HandHelping className="size-4" aria-hidden /> Aider
      </Link>
    );
  }
  if (type === 'project' && meta.repo_url) {
    return (
      <a href={String(meta.repo_url)} target="_blank" rel="noopener noreferrer" className={className}>
        Dépôt <ExternalLink className="size-3.5" aria-hidden />
      </a>
    );
  }
  return null;
}
