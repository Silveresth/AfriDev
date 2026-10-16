'use client';

import { HandHelping, Hammer, Layers, Sparkles, Star } from 'lucide-react';

import { formatCount } from '@/shared/lib';
import { Card } from '@/shared/ui';

import type { PublicProfile } from '../api';
import { BadgesCard, Endorsements, GitHubSection } from './ProSections';

/** Onglet « Craft & Stack » : double jauge détaillée, badges, compétences endossées, GitHub. */
export function CraftTab({ profile, isMe, accent }: { profile: PublicProfile; isMe: boolean; accent: string }) {
  const { craft } = profile;
  const max = Math.max(1, craft.help.score, craft.creation.score);
  return (
    <div className="space-y-4">
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-headline-md text-ink">
              <Sparkles className="size-5" style={{ color: accent }} aria-hidden /> Craft Score
            </h2>
            <p className="text-body-sm text-ink-muted">La réputation se gagne en aidant et en créant.</p>
          </div>
          <p className="text-display-sm font-semibold tabular-nums" style={{ color: accent }}>
            {formatCount(craft.score)}
          </p>
        </div>

        <Gauge
          icon={<HandHelping aria-hidden />}
          title="Entraide"
          score={craft.help.score}
          ratio={craft.help.score / max}
          barClass="bg-secondary"
          rows={[
            { label: 'Pouces levés sur ses réponses', value: craft.help.breakdown.answer_upvotes ?? 0, points: 5 },
            { label: 'Réponses acceptées', value: craft.help.breakdown.accepted_answers ?? 0, points: 15 },
          ]}
        />
        <Gauge
          icon={<Hammer aria-hidden />}
          title="Création"
          score={craft.creation.score}
          ratio={craft.creation.score / max}
          barClass="bg-primary"
          rows={[
            { label: 'Pouces levés sur ses posts', value: craft.creation.breakdown.post_upvotes ?? 0, points: 5 },
            { label: 'Snippets mis en favori', value: craft.creation.breakdown.snippet_saves ?? 0, points: 10 },
          ]}
        />
        {craft.project_stars ? (
          <p className="flex items-center gap-1.5 text-body-sm text-ink-muted">
            <Star className="size-4 text-tertiary" aria-hidden /> {formatCount(craft.project_stars)} étoiles GitHub sur ses projets open-source
          </p>
        ) : null}
      </Card>

      <BadgesCard profile={profile} />

      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-headline-md text-ink">
          <Layers className="size-5 text-ink-faint" aria-hidden /> Stack
        </h2>
        {profile.stack.length ? null : <p className="text-body-md text-ink-muted">{isMe ? 'Ajoutez vos technologies depuis « Modifier mon profil ».' : 'Stack non renseignée.'}</p>}
        <Endorsements profile={profile} isMe={isMe} />
      </Card>

      <GitHubSection profile={profile} />
    </div>
  );
}

function Gauge({
  icon,
  title,
  score,
  ratio,
  barClass,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  score: number;
  ratio: number;
  barClass: string;
  rows: Array<{ label: string; value: number; points: number }>;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-body-md font-semibold text-ink [&_svg]:size-4 [&_svg]:text-ink-faint">
          {icon} {title}
        </h3>
        <span className="text-body-md font-semibold text-ink tabular-nums">{formatCount(score)} pts</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-container-high"
        role="meter"
        aria-label={`Craft ${title}`}
        aria-valuenow={score}
        aria-valuemin={0}
      >
        <div className={`h-full rounded-full transition-[width] duration-700 ${barClass}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.label} className="flex justify-between rounded-lg bg-container-low px-3 py-1.5 text-body-sm">
            <span className="text-ink-muted">{row.label}</span>
            <span className="text-ink tabular-nums">
              {formatCount(row.value)} <span className="text-ink-faint">× {row.points}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
