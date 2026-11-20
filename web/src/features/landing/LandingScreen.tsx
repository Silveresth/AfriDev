import type { Schemas } from '@afridev/api-client';
import {
  AlertTriangle,
  Apple,
  ArrowBigUp,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Code2,
  FolderGit2,
  GitMerge,
  GitPullRequest,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  UsersRound,
  WifiOff,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { buttonClasses, HubIcon, Logo, LogoMark } from '@/shared/ui';

import { CodeGlobe } from './CodeGlobe';
import { FeedPhone, QuestionPhone } from './PhoneMockups';
import { ScrollEffects } from './ScrollEffects';

type Hub = Schemas['HubOutput'];
type Question = Schemas['QuestionOutput'];
type Project = Schemas['ProjectOutput'];

export interface LandingData {
  hubs: Hub[];
  questions: Question[];
  projects: Project[];
}

const NAV = [
  { href: '/feed', label: 'Fil' },
  { href: '/questions', label: 'Q&A' },
  { href: '/projects', label: 'Projets' },
  { href: '/jobs', label: 'Jobs' },
  { href: '#appli', label: 'Appli mobile' },
];

const STEPS = [
  {
    icon: UserPlus,
    title: 'Créez votre compte',
    text: 'Google, GitHub ou e-mail. Gratuit, sans publicité.',
  },
  {
    icon: Sparkles,
    title: 'Dites-nous votre stack',
    text: 'Votre fil se règle tout seul : apprendre, aider, recruter ou contribuer.',
  },
  {
    icon: GitPullRequest,
    title: 'Lancez-vous',
    text: 'Posez une question, répondez, partagez un snippet ou prenez une issue.',
  },
];

const APP_FEATURES = [
  { icon: Bell, title: 'Alertes en direct', text: 'Une réponse, une mention, un message : vous le savez tout de suite.' },
  { icon: Zap, title: 'Légère, même en 3G', text: 'Native et économe : mode « Texte seul », aucune vidéo ne démarre sans vous.' },
  { icon: WifiOff, title: 'Pensée hors ligne', text: 'Lisez et écrivez sans réseau, l’envoi part dès que ça revient.' },
  { icon: ShieldCheck, title: 'Compte protégé', text: 'Connexion GitHub ou e-mail, session gardée dans le coffre du téléphone.' },
];

const LANGUAGE_COLORS: Record<string, string> = {
  python: '#3572A5',
  javascript: '#f1e05a',
  typescript: '#3178c6',
  dart: '#00B4AB',
  kotlin: '#A97BFF',
  java: '#b07219',
  go: '#00ADD8',
  php: '#4F5D95',
  rust: '#dea584',
  swift: '#F05138',
  ruby: '#701516',
  'c#': '#178600',
};

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

const delay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as CSSProperties;
const rise = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** En-tête de section : sur-titre, titre, phrase. */
function SectionHead({
  id,
  eyebrow,
  title,
  text,
  center,
  action,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  text?: string;
  center?: boolean;
  action?: ReactNode;
}) {
  return (
    <div data-reveal className={`flex flex-wrap items-end gap-4 ${center ? 'justify-center text-center' : 'justify-between'}`}>
      <div className={`space-y-3 ${center ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}>
        <p className="text-label-md font-bold tracking-[0.14em] text-primary-ink uppercase">{eyebrow}</p>
        <h2 id={id} className="text-[1.75rem] leading-9 font-bold tracking-[-0.03em] text-balance text-ink sm:text-[2.5rem] sm:leading-[2.9rem]">
          {title}
        </h2>
        {text ? <p className="text-body-lg text-pretty text-ink-muted sm:text-[1.0625rem] sm:leading-7">{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1 text-body-sm font-semibold text-primary-ink">
      {children}
      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Petite carte flottante posée sur le globe. */
function GlobeChip({ icon, tone, title, meta, className, style }: { icon: ReactNode; tone: string; title: string; meta: string; className: string; style?: CSSProperties }) {
  return (
    <div
      className={`absolute flex animate-float items-center gap-2.5 rounded-2xl border border-line bg-card/85 py-2 pr-3.5 pl-2 shadow-[var(--elev-raised)] backdrop-blur-md ${className}`}
      style={style}
    >
      <span className={`flex size-8 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <span className="leading-tight">
        <span className="block text-body-sm font-semibold text-ink">{title}</span>
        <span className="block text-label-sm text-ink-muted">{meta}</span>
      </span>
    </div>
  );
}

/** Carte de la grille « ce que vous faites » : icône, titre, texte, aperçu, lien. */
function FeatureCard({
  icon: Icon,
  title,
  text,
  href,
  cta,
  children,
  className = '',
  style,
}: {
  icon: typeof Code2;
  title: string;
  text: string;
  href: string;
  cta: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Link
      href={href}
      data-reveal
      style={style}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-card p-6 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--elev-raised)] sm:p-7 ${className}`}
    >
      <div
        className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <span className="mb-5 flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-[1.1875rem] leading-6 font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 text-body-md text-pretty text-ink-muted">{text}</p>
      {children ? <div className="mt-6 flex-1" aria-hidden>{children}</div> : null}
      <span className="mt-6 inline-flex items-center gap-1 text-body-sm font-semibold text-primary-ink">
        {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </span>
    </Link>
  );
}

/** Aperçu Q&A : une question et la première réponse de l'IA, lignes de code qui s'écrivent. */
function QaPreview() {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap gap-1.5">
        {['django', 'mobile-money', 'webhook'].map((tag) => (
          <span key={tag} className="rounded-md bg-container px-2 py-0.5 font-mono text-[11px] text-ink-muted">
            {tag}
          </span>
        ))}
      </div>
      <p className="text-headline-md text-ink">Le webhook de paiement arrive deux fois, comment éviter le double crédit ?</p>
      <div className="space-y-2.5 rounded-xl border border-primary/20 bg-primary-soft/50 p-3.5">
        <p className="flex items-center gap-1.5 text-label-md font-semibold text-primary-ink">
          <Sparkles className="size-3.5" /> Première réponse de l’IA · 4 secondes
        </p>
        <pre className="overflow-x-auto rounded-lg bg-code-bg p-3 font-mono text-[12px] leading-5 text-code-ink">
          {[
            ['tx, created = Payment.objects.get_or_create(', ''],
            ['    provider_ref=payload["id"],', ''],
            ['    defaults={"amount": payload["amount"]},', ''],
            [')', ''],
            ['if not created: return 200  ', '# déjà traité'],
          ].map(([code, comment], index) => (
            <code key={index} className="block animate-type-in" style={{ animationDelay: `${300 + index * 160}ms` }}>
              {code}
              {comment ? <span className="text-[var(--sh-comment)]">{comment}</span> : null}
            </code>
          ))}
        </pre>
      </div>
      <div className="flex items-center justify-between text-label-md text-ink-muted">
        <span className="flex items-center gap-1.5 font-medium text-secondary-ink">
          <CheckCircle2 className="size-4" /> Validée par la communauté
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <ArrowBigUp className="size-4" /> 42
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3.5" /> 3
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Page de présentation (« / ») pour les visiteurs : en un coup d'œil, ce qu'est AfriDev
 * (l'entraide entre devs africains), ce qu'on y fait, l'appli mobile, l'activité réelle
 * (lue côté serveur) et comment commencer. Les membres connectés vont directement sur leur fil.
 */
export function LandingScreen({ data }: { data: LandingData }) {
  const { hubs, questions, projects } = data;
  // Bandeau défilant : on répète les hubs pour qu'il remplisse toujours la largeur.
  const hubLoop = hubs.length ? Array.from({ length: Math.max(2, Math.ceil(12 / hubs.length)) }, () => hubs).flat() : [];

  return (
    <div className="min-h-dvh overflow-x-clip bg-surface text-ink">
      <ScrollEffects />

      {/* En-tête */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="AfriDev, accueil">
            <Logo />
          </Link>
          <nav aria-label="Rubriques" className="hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-body-sm font-medium text-ink-muted transition-colors hover:bg-container hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className={buttonClasses({ variant: 'plain', size: 'sm', className: 'hidden sm:inline-flex' })}>
              Se connecter
            </Link>
            <Link href="/register" className={buttonClasses({ size: 'sm' })}>
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      <main id="contenu">
        {/* ── Hero : ce qu'est AfriDev, en une phrase ── */}
        <section className="relative isolate overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(var(--line-strong)_1px,transparent_1.2px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)] bg-[length:24px_24px] opacity-50"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-[-20%] right-[-10%] -z-10 size-[44rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_16%,transparent),transparent)] blur-2xl"
            aria-hidden
          />
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-6 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-4 lg:pt-16 lg:pb-20">
            <div className="min-w-0 space-y-7">
              <p
                className="inline-flex animate-rise items-center gap-2 rounded-full border border-line bg-card/80 py-1 pr-3.5 pl-2 text-label-md font-semibold text-ink-muted shadow-[var(--elev-card)] backdrop-blur"
                style={rise(0)}
              >
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inset-0 animate-ping-soft rounded-full bg-secondary" />
                  <span className="relative size-2 rounded-full bg-secondary" />
                </span>
                Le réseau d’entraide des développeur·ses africain·es
              </p>
              <h1
                className="animate-rise text-[2.6rem] leading-[1.02] font-black tracking-[-0.045em] text-balance text-ink sm:text-[3.75rem] lg:text-[4.25rem]"
                style={rise(80)}
              >
                Bloqué sur du code ?{' '}
                <span className="text-brand-gradient">L’Afrique tech</span> vous répond.
              </h1>
              <p className="max-w-xl animate-rise text-[1.0625rem] leading-7 text-pretty text-ink-muted sm:text-lg sm:leading-8" style={rise(160)}>
                Posez votre question, obtenez une réponse de la communauté et de l’IA en quelques minutes. Partagez votre
                code, rejoignez des projets open source et trouvez votre prochaine mission.
              </p>
              <div className="flex animate-rise flex-wrap gap-3" style={rise(240)}>
                <Link href="/register" className={buttonClasses({ size: 'lg', className: 'shadow-[0_10px_30px_-10px_var(--primary)]' })}>
                  Rejoindre gratuitement <ArrowRight className="size-5" aria-hidden />
                </Link>
                <Link href="/questions" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
                  Voir les questions
                </Link>
              </div>
              <div className="flex animate-rise flex-wrap items-center gap-x-5 gap-y-2 text-body-sm text-ink-muted" style={rise(320)}>
                {['Gratuit, sans publicité', 'Marche en 3G et hors ligne', 'Appli Android et iOS bientôt'].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-secondary-ink" aria-hidden /> {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Globe : l'Afrique en code, une pique par ville tech */}
            <div className="relative mx-auto aspect-square w-full max-w-[34rem] animate-rise" style={rise(200)}>
              <CodeGlobe className="absolute inset-0 size-full" />
              <GlobeChip
                className="top-[12%] left-0 sm:left-[2%]"
                tone="bg-secondary-soft text-secondary-ink"
                icon={<CheckCircle2 className="size-4" />}
                title="Réponse validée"
                meta="Lagos · il y a 2 min"
              />
              <GlobeChip
                className="top-[46%] right-0 hidden sm:flex"
                style={{ animationDelay: '-2s' }}
                tone="bg-primary-soft text-primary-ink"
                icon={<Code2 className="size-4" />}
                title="Nouveau snippet"
                meta="Nairobi · Flutter"
              />
              <GlobeChip
                className="bottom-[8%] left-[6%]"
                style={{ animationDelay: '-4s' }}
                tone="bg-[#ecebff] text-[#5145d6] dark:bg-downvote-soft dark:text-downvote"
                icon={<GitMerge className="size-4" />}
                title="Pull request fusionnée"
                meta="Dakar · afri-pay"
              />
            </div>
          </div>
        </section>

        {/* ── Ce que vous faites sur AfriDev ── */}
        <section className="mx-auto max-w-6xl space-y-12 px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="usages">
          <SectionHead
            id="usages"
            center
            eyebrow="Ce que vous faites sur AfriDev"
            title="Tout pour avancer, au même endroit."
            text="Une question qui bloque, un bout de code à garder, un projet à rejoindre : la communauté est là."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <FeatureCard
              className="lg:col-span-2 lg:row-span-2"
              icon={MessagesSquare}
              title="Posez votre question, recevez une réponse"
              text="À l’écrit ou à la voix. L’IA propose une première piste en citant les solutions déjà validées, puis la communauté complète."
              href="/questions"
              cta="Parcourir les questions"
            >
              <QaPreview />
            </FeatureCard>
            <FeatureCard
              style={delay(80)}
              icon={Newspaper}
              title="Un fil technique, sans bruit"
              text="Retours d’expérience, déploiements, mobile money : réglé sur votre stack."
              href="/feed"
              cta="Voir le fil"
            />
            <FeatureCard
              style={delay(160)}
              icon={Code2}
              title="Vos snippets, même hors ligne"
              text="Docker, USSD, SQL : gardés sur votre appareil. Une clé d’API collée par erreur est bloquée."
              href="/snippets"
              cta="Découvrir les snippets"
            >
              <div className="overflow-hidden rounded-xl bg-code-bg font-mono text-[11px] leading-5 text-code-ink">
                <p className="px-3 pt-2.5">docker compose up -d</p>
                <p className="flex items-center gap-1.5 border-t border-code-line bg-[rgba(209,36,47,0.18)] px-3 py-1.5 text-[#ffb3b0]">
                  <AlertTriangle className="size-3" /> STRIPE_KEY=sk_live_•••• bloquée
                </p>
              </div>
            </FeatureCard>
            <FeatureCard
              style={delay(80)}
              icon={FolderGit2}
              title="L’open source africain"
              text="Trouvez un projet qui recrute et prenez une première issue, guidé pas à pas."
              href="/projects"
              cta="Voir les projets"
            >
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-label-md">
                <CircleDot className="size-4 shrink-0 text-secondary-ink" />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">Ajouter le support Wave</span>
                <span className="shrink-0 rounded-full bg-secondary-soft px-2 py-0.5 font-semibold text-on-secondary-soft">good first issue</span>
              </div>
            </FeatureCard>
            {hubLoop.length ? (
              <Link
                href="/hubs"
                data-reveal
                style={delay(160)}
                className="group relative flex flex-col justify-between gap-6 overflow-hidden rounded-3xl border border-line bg-card py-6 transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-[var(--elev-raised)] sm:py-7 lg:col-span-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 px-6 sm:px-7">
                  <div className="max-w-md">
                    <span className="mb-5 flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
                      <UsersRound className="size-5" aria-hidden />
                    </span>
                    <h3 className="text-[1.1875rem] leading-6 font-semibold tracking-tight text-ink">Rejoignez votre communauté</h3>
                    <p className="mt-2 text-body-md text-ink-muted">Un hub par techno, par pays ou par métier.</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-body-sm font-semibold text-primary-ink">
                    Tous les hubs <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </div>
                <div className="relative [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]" aria-hidden>
                  <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
                    {[...hubLoop, ...hubLoop].map((hub, index) => (
                      <span key={`${hub.id}-${index}`} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface py-2 pr-4 pl-2">
                        <HubIcon icon={hub.icon} name={hub.name} size={30} className="rounded-lg" />
                        <span>
                          <span className="block text-body-sm font-semibold text-ink">{hub.name}</span>
                          <span className="block text-label-sm text-ink-muted">
                            {compact.format(hub.member_count)} membre{hub.member_count > 1 ? 's' : ''}
                          </span>
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ) : (
              <FeatureCard
                className="lg:col-span-2"
                style={delay(160)}
                icon={BriefcaseBusiness}
                title="Trouvez votre prochaine mission"
                text="Offres d’emploi, missions freelance et événements tech, partout sur le continent."
                href="/jobs"
                cta="Voir les offres"
              />
            )}
          </div>
        </section>

        {/* ── L'application mobile native ── */}
        <section
          id="appli"
          className="relative isolate scroll-mt-16 overflow-hidden bg-[#07090d] text-[#EDEDEF]"
          aria-labelledby="appli-titre"
          data-progress
        >
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="absolute top-[-30%] left-[-10%] size-[40rem] rounded-full bg-[radial-gradient(closest-side,rgba(200,75,32,0.28),transparent)] blur-2xl" />
            <div className="absolute right-[-10%] bottom-[-30%] size-[36rem] rounded-full bg-[radial-gradient(closest-side,rgba(26,127,75,0.22),transparent)] blur-2xl" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] bg-[size:48px_48px]" />
          </div>
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-28">
            <div className="space-y-8">
              <div data-reveal="left" className="space-y-4">
                <p className="text-label-md font-bold tracking-[0.14em] text-[#FF9B76] uppercase">Application mobile</p>
                <h2 id="appli-titre" className="text-[2.5rem] leading-[1.05] font-black tracking-[-0.04em] text-balance sm:text-[3.5rem]">
                  AfriDev dans votre poche.
                </h2>
                <p className="max-w-lg text-[1.0625rem] leading-7 text-[#A1A1AA]">
                  Les applications natives Android et iOS arrivent : le même compte, le même fil, les mêmes réponses que
                  sur le web, avec les notifications en plus.
                </p>
              </div>
              <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {APP_FEATURES.map(({ icon: Icon, title, text }, index) => (
                  <li key={title} data-reveal style={delay(100 + index * 80)} className="flex gap-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#FF9B76]">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="mt-1 text-body-sm text-[#A1A1AA]">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div data-reveal style={delay(420)} className="flex flex-wrap gap-3">
                {[
                  {
                    label: 'Android',
                    icon: (
                      <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
                        <path d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22A11.4 11.4 0 0 0 12 8.12c-1.77 0-3.43.38-4.92 1.02L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
                      </svg>
                    ),
                  },
                  { label: 'iPhone et iPad', icon: <Apple className="size-7" aria-hidden /> },
                ].map((store) => (
                  <span
                    key={store.label}
                    className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] py-2.5 pr-5 pl-3.5 backdrop-blur"
                  >
                    {store.icon}
                    <span className="leading-tight">
                      <span className="block text-[10px] font-semibold tracking-[0.12em] text-[#A1A1AA] uppercase">Bientôt sur</span>
                      <span className="block text-[1.0625rem] font-semibold">{store.label}</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Téléphones : légère parallaxe au défilement (--progress posé par ScrollEffects) */}
            <div className="relative mx-auto h-[36rem] w-full max-w-[34rem] sm:h-[40rem]" aria-hidden>
              <p className="sr-only">Aperçu de l’application mobile : fil d’accueil et question avec réponse de l’IA.</p>
              <div
                className="absolute top-14 right-0 hidden transition-transform duration-100 ease-out will-change-transform sm:block"
                style={{ transform: 'translateY(calc((1 - var(--progress, 1)) * 140px)) rotate(calc(4deg + (1 - var(--progress, 1)) * 6deg))' }}
              >
                <QuestionPhone />
              </div>
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 transition-transform duration-100 ease-out will-change-transform sm:left-0 sm:translate-x-0"
                style={{ transform: 'translateY(calc((1 - var(--progress, 1)) * 60px)) rotate(calc(-4deg - (1 - var(--progress, 1)) * 4deg))' }}
              >
                <FeedPhone />
              </div>
            </div>
          </div>
        </section>

        {/* ── En direct : activité réelle ── */}
        {questions.length || projects.length ? (
          <section className="mx-auto max-w-6xl space-y-12 px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="direct">
            <SectionHead
              id="direct"
              eyebrow="En ce moment sur AfriDev"
              title={
                <span className="inline-flex items-center gap-3">
                  <span className="relative flex size-3" aria-hidden>
                    <span className="absolute inset-0 animate-ping-soft rounded-full bg-secondary" />
                    <span className="relative size-3 rounded-full bg-secondary" />
                  </span>
                  Des devs attendent votre aide.
                </span>
              }
              text="Une réponse de votre part peut débloquer quelqu’un aujourd’hui."
            />
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              {questions.length ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-headline-md text-ink">Questions ouvertes</h3>
                    <MoreLink href="/questions">Toutes les questions</MoreLink>
                  </div>
                  <ul className="space-y-3">
                    {questions.map((question, index) => (
                      <li key={question.id} data-reveal style={delay(index * 70)}>
                        <Link
                          href={`/questions/${question.id}`}
                          className="group flex items-start gap-4 rounded-2xl border border-line bg-card p-4 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--elev-raised)] sm:p-5"
                        >
                          <span
                            className={`flex w-14 shrink-0 flex-col items-center rounded-xl py-2 ${
                              question.answer_count ? 'bg-secondary-soft text-on-secondary-soft' : 'bg-tertiary-soft text-on-tertiary-soft'
                            }`}
                          >
                            <span className="text-headline-md leading-5">{question.answer_count}</span>
                            <span className="text-label-sm">réponse{question.answer_count > 1 ? 's' : ''}</span>
                          </span>
                          <span className="min-w-0 flex-1 space-y-2">
                            <span className="line-clamp-2 font-semibold text-ink group-hover:text-primary-ink">{question.title}</span>
                            <span className="flex flex-wrap items-center gap-1.5">
                              {question.answer_count ? null : (
                                <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-label-sm font-semibold text-primary-ink">
                                  Répondez en premier
                                </span>
                              )}
                              {question.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-md bg-container px-1.5 py-0.5 font-mono text-label-sm text-ink-muted">
                                  {tag}
                                </span>
                              ))}
                            </span>
                          </span>
                          <ChevronRight className="mt-1 size-5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {projects.length ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-headline-md text-ink">Projets qui recrutent</h3>
                    <MoreLink href="/projects">Tous les projets</MoreLink>
                  </div>
                  <ul className="space-y-3">
                    {projects.map((project, index) => (
                      <li key={project.id} data-reveal style={delay(100 + index * 70)}>
                        <Link
                          href={`/projects/${project.id}`}
                          className="group block space-y-3 rounded-2xl border border-line bg-card p-5 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--elev-raised)]"
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-container text-ink-muted">
                                <FolderGit2 className="size-[18px]" aria-hidden />
                              </span>
                              <span className="truncate font-semibold text-ink group-hover:text-primary-ink">{project.name}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-secondary-soft px-2 py-0.5 text-label-sm font-semibold text-on-secondary-soft">
                              Recrute
                            </span>
                          </span>
                          {project.description ? <span className="line-clamp-2 block text-body-sm text-ink-muted">{project.description}</span> : null}
                          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-md text-ink-muted">
                            {project.language ? (
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="size-2.5 rounded-full"
                                  style={{ background: LANGUAGE_COLORS[project.language.toLowerCase()] ?? '#8b949e' }}
                                />
                                {project.language}
                              </span>
                            ) : null}
                            <span className="flex items-center gap-1">
                              <Star className="size-3.5" aria-hidden /> {compact.format(project.stars)}
                            </span>
                            <span className="flex items-center gap-1">
                              <CircleDot className="size-3.5" aria-hidden /> {project.open_issue_count} issue
                              {project.open_issue_count > 1 ? 's' : ''} ouverte{project.open_issue_count > 1 ? 's' : ''}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── Trois étapes ── */}
        <section className="border-y border-line bg-card/60" aria-labelledby="etapes">
          <div className="mx-auto max-w-6xl space-y-14 px-4 py-20 sm:px-6 lg:py-24">
            <SectionHead id="etapes" center eyebrow="Pour commencer" title="Prêt en moins d’une minute." />
            <div className="relative" data-progress>
              <div className="steps-track absolute top-6 right-[16.66%] left-[16.66%] hidden h-0.5 overflow-hidden rounded-full bg-line md:block" aria-hidden />
              <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
                {STEPS.map((step, index) => (
                  <li key={step.title} data-reveal style={delay(index * 140)} className="flex flex-col items-center text-center">
                    <span className="relative mb-5 flex size-12 items-center justify-center rounded-2xl border border-line bg-card text-primary-ink shadow-[var(--elev-raised)]">
                      <step.icon className="size-5" aria-hidden />
                      <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-ink font-mono text-[10px] font-bold text-surface">
                        {index + 1}
                      </span>
                    </span>
                    <h3 className="text-headline-md text-ink">{step.title}</h3>
                    <p className="mt-1.5 max-w-[16rem] text-body-sm text-ink-muted">{step.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── Appel final ── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div
            data-reveal
            className="relative isolate overflow-hidden rounded-[2rem] border border-line bg-card px-6 py-16 text-center shadow-[var(--elev-raised)] sm:px-12 sm:py-20"
          >
            <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
              <div className="absolute inset-0 bg-[radial-gradient(var(--line-strong)_1px,transparent_1.2px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] bg-[length:20px_20px] opacity-60" />
              <div className="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_18%,transparent),transparent)]" />
            </div>
            <LogoMark size={56} className="mx-auto mb-6 drop-shadow-[0_12px_24px_rgba(200,75,32,0.35)]" />
            <h2 className="mx-auto max-w-2xl text-[2rem] leading-[1.1] font-black tracking-[-0.04em] text-balance text-ink sm:text-[3rem]">
              Votre prochaine réponse est à une question près.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-body-lg text-ink-muted">
              Inscription gratuite avec Google, GitHub ou un e-mail. Votre fil se règle juste après.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register" className={buttonClasses({ size: 'lg', className: 'shadow-[0_10px_30px_-10px_var(--primary)]' })}>
                Créer mon compte <ArrowRight className="size-5" aria-hidden />
              </Link>
              <Link href="/login" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
                J’ai déjà un compte
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Pied de page */}
      <footer className="border-t border-line bg-shell">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-body-sm text-ink-muted">
              Apprendre, s’entraider et contribuer entre développeur·ses africain·es, même avec une petite connexion.
            </p>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-label-md text-ink-muted">
              <Apple className="size-3.5" aria-hidden /> Android et iOS : bientôt
            </p>
          </div>
          {[
            {
              title: 'Plateforme',
              links: [
                { href: '/feed', label: 'Fil d’actualité' },
                { href: '/questions', label: 'Questions' },
                { href: '/snippets', label: 'Snippets' },
                { href: '/hubs', label: 'Hubs' },
              ],
            },
            {
              title: 'Opportunités',
              links: [
                { href: '/projects', label: 'Projets open source' },
                { href: '/jobs', label: 'Offres d’emploi' },
                { href: '/events', label: 'Événements' },
                { href: '/news', label: 'Actu tech' },
              ],
            },
            {
              title: 'Compte',
              links: [
                { href: '/register', label: 'Créer un compte' },
                { href: '/login', label: 'Se connecter' },
                { href: '/forgot-password', label: 'Mot de passe oublié' },
              ],
            },
          ].map((column) => (
            <nav key={column.title} aria-label={column.title} className="space-y-3">
              <p className="text-label-md font-bold tracking-[0.12em] text-ink uppercase">{column.title}</p>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-body-sm text-ink-muted transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-5 text-label-md text-ink-faint sm:px-6">© {new Date().getFullYear()} AfriDev Exchange</p>
        </div>
      </footer>
    </div>
  );
}
