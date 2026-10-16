'use client';

import { computeFeedMix } from '@afridev/validation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  Clapperboard,
  Cloud,
  Code2,
  Compass,
  Crown,
  Database,
  FolderGit2,
  Github,
  GraduationCap,
  HandHelping,
  Lightbulb,
  type LucideIcon,
  MessagesSquare,
  Newspaper,
  Palette,
  Plus,
  Rocket,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Sprout,
  Store,
  Users,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { useJoinHub } from '@/features/hubs';
import { useFollow } from '@/features/profile';
import { errorMessage } from '@/shared/api';
import { cn, formatCount } from '@/shared/lib';
import { Avatar, Button, Skeleton } from '@/shared/ui';

import { type Onboarding, type Preferences, type Suggestions, useOnboarding, useSavePreferences, useSkipOnboarding, useSuggestions } from '../onboarding';

const LEVEL_ICONS: Record<string, LucideIcon> = { student: GraduationCap, junior: Sprout, mid: Code2, senior: Rocket, founder: Crown };
const GOAL_ICONS: Record<string, LucideIcon> = {
  learn: BookOpen,
  help: HandHelping,
  job: Briefcase,
  hire: Search,
  collab: FolderGit2,
  share: Lightbulb,
  watch: Newspaper,
};
const TOPIC_ICONS: Record<string, LucideIcon> = {
  web: Compass,
  backend: Database,
  mobile: Smartphone,
  devops: Cloud,
  data_ai: Sparkles,
  fintech: Wallet,
  offline: WifiOff,
  security: Shield,
  opensource: FolderGit2,
  career: Briefcase,
  startup: Store,
  design: Palette,
};
const MIX_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  post: { label: 'Posts', icon: Newspaper, color: 'bg-primary' },
  question: { label: 'Entraide Q&A', icon: MessagesSquare, color: 'bg-secondary' },
  snippet: { label: 'Snippets', icon: Code2, color: 'bg-sky-500' },
  project: { label: 'Projets', icon: FolderGit2, color: 'bg-violet-500' },
  job: { label: 'Offres', icon: Briefcase, color: 'bg-amber-500' },
  event: { label: 'Événements', icon: Users, color: 'bg-pink-500' },
  news: { label: 'Actu tech', icon: Newspaper, color: 'bg-zinc-500' },
  video: { label: 'Vidéos', icon: Clapperboard, color: 'bg-rose-500' },
};

const STEPS = ['Profil', 'Objectifs', 'Thématiques', 'Stack', 'Communauté'] as const;

interface Draft {
  experience_level: string;
  goals: string[];
  topics: string[];
  stack: string[];
  learning: string[];
}

/**
 * Accueil des nouveaux membres, en 5 étapes, une fois par compte (needs_onboarding) :
 * qui vous êtes → ce que vous cherchez (aperçu du fil en direct) → thématiques → stack
 * maîtrisée et à apprendre (import GitHub) → membres et hubs à suivre d'après vos choix.
 */
export function OnboardingWizard({ name, onDone }: { name: string; onDone: () => void }) {
  const onboarding = useOnboarding(true);
  const skip = useSkipOnboarding();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/80 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label="Personnaliser AfriDev">
      <div className="animate-pop flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-2xl">
        {onboarding.data ? (
          <Wizard catalogue={onboarding.data} name={name} onDone={onDone} onSkip={() => skip.mutate(undefined, { onSettled: onDone })} skipping={skip.isPending} />
        ) : (
          <div className="space-y-4 p-8">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-40" />
          </div>
        )}
      </div>
    </div>
  );
}

function Wizard({ catalogue, name, onDone, onSkip, skipping }: { catalogue: Onboarding; name: string; onDone: () => void; onSkip: () => void; skipping: boolean }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => ({ ...catalogue.current }));
  const save = useSavePreferences();
  const toggle = (key: 'goals' | 'topics', id: string) =>
    setDraft((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((v) => v !== id) : [...current[key], id] }));

  const canNext = [Boolean(draft.experience_level), draft.goals.length > 0, draft.topics.length > 0, draft.stack.length + draft.learning.length > 0, true][step];

  async function next() {
    if (step === 3) {
      // Fin du questionnaire : on enregistre, les suggestions s'appuient sur ces choix.
      try {
        // Les identifiants viennent du catalogue de l'API : ce sont des codes valides.
        await save.mutateAsync(draft as Preferences);
      } catch {
        return; // erreur affichée sous les boutons
      }
    }
    if (step === STEPS.length - 1) onDone();
    else setStep(step + 1);
  }

  return (
    <>
      <header className="space-y-4 border-b border-line px-6 pt-6 pb-4 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-label-md font-semibold tracking-wide text-primary-ink uppercase">
            Étape {step + 1} / {STEPS.length} · {STEPS[step]}
          </p>
          {step < 4 ? (
            <button type="button" onClick={onSkip} disabled={skipping} className="text-body-sm text-ink-muted hover:text-ink">
              Plus tard
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-5 gap-1.5" aria-hidden>
          {STEPS.map((label, index) => (
            <span key={label} className={cn('h-1.5 rounded-full transition-colors duration-500', index <= step ? 'bg-primary' : 'bg-container-high')} />
          ))}
        </div>
      </header>

      <div key={step} className="animate-step flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        {step === 0 ? (
          <StepShell title={`Bienvenue ${name} 👋 Vous êtes plutôt…`} subtitle="Pour doser le niveau des contenus proposés.">
            <ChoiceGrid
              items={catalogue.levels}
              icons={LEVEL_ICONS}
              selected={[draft.experience_level]}
              onToggle={(id) => setDraft((current) => ({ ...current, experience_level: id }))}
            />
          </StepShell>
        ) : null}
        {step === 1 ? (
          <StepShell title="Qu'est-ce qui vous amène ?" subtitle="Plusieurs choix possibles : votre fil se compose en direct.">
            <div className="grid gap-5 lg:grid-cols-[1fr_15rem]">
              <ChoiceGrid items={catalogue.goals} icons={GOAL_ICONS} selected={draft.goals} onToggle={(id) => toggle('goals', id)} multi />
              <FeedPreview catalogue={catalogue} draft={draft} />
            </div>
          </StepShell>
        ) : null}
        {step === 2 ? (
          <StepShell title="Les sujets qui vous parlent" subtitle="Ils deviennent les tags suivis par votre fil et vos notifications.">
            <ChoiceGrid items={catalogue.topics} icons={TOPIC_ICONS} selected={draft.topics} onToggle={(id) => toggle('topics', id)} multi compact />
          </StepShell>
        ) : null}
        {step === 3 ? <StackStep catalogue={catalogue} draft={draft} onChange={setDraft} /> : null}
        {step === 4 ? <CommunityStep tags={[...draft.stack, ...draft.learning]} /> : null}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line bg-container-low/60 px-6 py-4 sm:px-8">
        <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || step === 4}>
          <ArrowLeft className="size-4" aria-hidden /> Retour
        </Button>
        <div className="flex items-center gap-3">
          {save.isError ? <p className="text-body-sm text-danger">{errorMessage(save.error)}</p> : null}
          <Button onClick={() => void next()} disabled={!canNext} loading={save.isPending}>
            {step === 4 ? 'Découvrir mon fil' : step === 3 ? 'Enregistrer' : 'Continuer'}
            {step === 4 ? <Sparkles className="size-4" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </div>
      </footer>
    </>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-headline-lg text-ink">{title}</h2>
        <p className="text-body-sm text-ink-muted">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ChoiceGrid({
  items,
  icons,
  selected,
  onToggle,
  multi = false,
  compact = false,
}: {
  items: { id: string; label: string }[];
  icons: Record<string, LucideIcon>;
  selected: string[];
  onToggle: (id: string) => void;
  multi?: boolean;
  compact?: boolean;
}) {
  return (
    <div role={multi ? 'group' : 'radiogroup'} className={cn('grid gap-2.5', compact ? 'grid-cols-2 sm:grid-cols-3' : 'sm:grid-cols-2')}>
      {items.map((item) => {
        const active = selected.includes(item.id);
        const Icon = icons[item.id] ?? Sparkles;
        return (
          <button
            key={item.id}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={active}
            onClick={() => onToggle(item.id)}
            className={cn(
              'group relative flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all',
              active ? 'border-primary bg-primary-soft/40 shadow-sm' : 'border-line hover:-translate-y-px hover:border-line-strong',
            )}
          >
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                active ? 'bg-primary text-on-primary' : 'bg-container text-ink-muted group-hover:text-ink',
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="flex-1 text-body-sm font-semibold text-ink">{item.label}</span>
            {active ? <Check className="size-4 text-primary-ink" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Composition de « Pour vous », recalculée à chaque objectif coché (règle du serveur). */
function FeedPreview({ catalogue, draft }: { catalogue: Onboarding; draft: Draft }) {
  const mix = computeFeedMix(catalogue, draft.goals, draft.experience_level);
  const entries = Object.entries(mix);
  return (
    <aside className="space-y-3 rounded-2xl border border-line bg-container-low/60 p-4" aria-live="polite">
      <p className="flex items-center gap-1.5 text-body-sm font-semibold text-ink">
        <Sparkles className="size-4 text-primary" aria-hidden /> Votre fil « Pour vous »
      </p>
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
        {entries.map(([kind, share]) => (
          <span key={kind} className={cn('transition-[width] duration-500', MIX_META[kind]?.color ?? 'bg-zinc-400')} style={{ width: `${share}%` }} />
        ))}
      </div>
      <ul className="space-y-1.5">
        {entries.slice(0, 6).map(([kind, share]) => {
          const meta = MIX_META[kind];
          return (
            <li key={kind} className="flex items-center gap-2 text-body-sm">
              <span className={cn('size-2 rounded-full', meta?.color ?? 'bg-zinc-400')} aria-hidden />
              <span className="flex-1 text-ink-muted">{meta?.label ?? kind}</span>
              <span className="font-semibold text-ink tabular-nums">{share} %</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function StackStep({ catalogue, draft, onChange }: { catalogue: Onboarding; draft: Draft; onChange: (draft: Draft) => void }) {
  const [target, setTarget] = useState<'stack' | 'learning'>('stack');
  const [input, setInput] = useState('');
  const suggestions = useMemo(() => {
    const fromTopics = catalogue.topics.filter((topic) => draft.topics.includes(topic.id)).flatMap((topic) => topic.suggest);
    return [...new Set([...catalogue.github_stack, ...fromTopics])].filter((tag) => !draft.stack.includes(tag) && !draft.learning.includes(tag));
  }, [catalogue, draft]);

  const add = (raw: string, where = target) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || draft.stack.includes(tag) || draft.learning.includes(tag) || draft[where].length >= 20) return;
    onChange({ ...draft, [where]: [...draft[where], tag] });
  };
  const remove = (where: 'stack' | 'learning', tag: string) => onChange({ ...draft, [where]: draft[where].filter((v) => v !== tag) });
  const github = catalogue.github_stack.filter((tag) => !draft.stack.includes(tag));

  return (
    <StepShell title="Votre stack" subtitle="Ce que vous maîtrisez sert aux recommandations de projets ; ce que vous apprenez oriente votre fil.">
      {github.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-container-low/60 p-3.5">
          <p className="flex items-center gap-2 text-body-sm text-ink">
            <Github className="size-4" aria-hidden /> Détecté sur votre GitHub : <strong>{github.join(', ')}</strong>
          </p>
          <Button size="sm" variant="secondary" onClick={() => onChange({ ...draft, stack: [...new Set([...draft.stack, ...github])].slice(0, 20) })}>
            Tout importer
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['stack', 'Je maîtrise', draft.stack],
            ['learning', 'Je veux apprendre', draft.learning],
          ] as const
        ).map(([where, label, tags]) => (
          <button
            key={where}
            type="button"
            onClick={() => setTarget(where)}
            aria-pressed={target === where}
            className={cn(
              'min-h-28 space-y-2 rounded-2xl border p-3.5 text-left transition-colors',
              target === where ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong',
            )}
          >
            <span className="flex items-center justify-between text-body-sm font-semibold text-ink">
              {label}
              <span className="text-label-md font-normal text-ink-faint">{tags.length} / 20</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {tags.length ? (
                tags.map((tag) => (
                  <span
                    key={tag}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      remove(where, tag);
                    }}
                    onKeyDown={(event) => event.key === 'Enter' && remove(where, tag)}
                    className={cn(
                      'inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-label-md font-semibold',
                      where === 'stack' ? 'bg-primary text-on-primary' : 'bg-secondary-soft text-secondary-ink',
                    )}
                    aria-label={`Retirer ${tag}`}
                  >
                    {tag} ×
                  </span>
                ))
              ) : (
                <span className="text-label-md text-ink-faint">{target === where ? 'Touchez une suggestion ci-dessous' : 'Touchez pour remplir cette colonne'}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          add(input);
          setInput('');
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ajouter à « ${target === 'stack' ? 'Je maîtrise' : 'Je veux apprendre'} » (ex. laravel)`}
          maxLength={30}
          className="h-10 flex-1 rounded-xl border border-line-strong bg-card px-3.5 text-body-sm text-ink placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={!input.trim()}>
          <Plus className="size-4" aria-hidden /> Ajouter
        </Button>
      </form>

      {suggestions.length ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 24).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-body-sm text-ink-muted transition-colors hover:border-primary hover:text-ink"
            >
              <Plus className="size-3.5" aria-hidden /> {tag}
            </button>
          ))}
        </div>
      ) : null}
    </StepShell>
  );
}

function CommunityStep({ tags }: { tags: string[] }) {
  const suggestions = useSuggestions(tags, true);
  return (
    <StepShell title="Votre communauté, déjà prête" subtitle="Des devs et des hubs proches de votre stack. Suivez-en quelques-uns pour démarrer.">
      {suggestions.isPending ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : (
        <CommunityLists data={suggestions.data} />
      )}
    </StepShell>
  );
}

function CommunityLists({ data }: { data?: Suggestions }) {
  if (!data || (!data.people.length && !data.hubs.length)) {
    return <p className="text-body-md text-ink-muted">La communauté se construit : vos premiers abonnements viendront du fil.</p>;
  }
  return (
    <div className="space-y-6">
      {data.people.length ? (
        <div className="space-y-2">
          <h3 className="text-body-sm font-semibold text-ink">Développeur·ses à suivre</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.people.map((person) => (
              <PersonRow key={person.id} person={person} />
            ))}
          </ul>
        </div>
      ) : null}
      {data.hubs.length ? (
        <div className="space-y-2">
          <h3 className="text-body-sm font-semibold text-ink">Hubs à rejoindre</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.hubs.map((hub) => (
              <HubRow key={hub.id} hub={hub} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PersonRow({ person }: { person: Suggestions['people'][number] }) {
  const follow = useFollow(person.username);
  const [followed, setFollowed] = useState(false);
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line p-3">
      <Avatar name={person.display_name} src={person.avatar_url} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm font-semibold text-ink">{person.display_name}</span>
        <span className="block truncate text-label-md text-ink-muted">
          {person.shared_stack.length ? `Comme vous : ${person.shared_stack.join(', ')}` : `✦ ${formatCount(person.craft_score)} Craft`}
        </span>
      </span>
      <Button
        size="sm"
        variant={followed ? 'outline' : 'primary'}
        loading={follow.isPending}
        onClick={() => follow.mutate(!followed, { onSuccess: (state) => setFollowed(state.is_following) })}
      >
        {followed ? 'Suivi·e' : 'Suivre'}
      </Button>
    </li>
  );
}

function HubRow({ hub }: { hub: Suggestions['hubs'][number] }) {
  const join = useJoinHub(hub);
  const [joined, setJoined] = useState(false);
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-container text-body-sm font-bold text-ink">
        {hub.icon && !hub.icon.startsWith('http') ? hub.icon : hub.name.slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm font-semibold text-ink">h/{hub.slug}</span>
        <span className="block truncate text-label-md text-ink-muted">{formatCount(hub.member_count)} membres</span>
      </span>
      <Button size="sm" variant={joined ? 'outline' : 'secondary'} loading={join.isPending} onClick={() => join.mutate(!joined, { onSuccess: () => setJoined(!joined) })}>
        {joined ? 'Membre' : 'Rejoindre'}
      </Button>
    </li>
  );
}
