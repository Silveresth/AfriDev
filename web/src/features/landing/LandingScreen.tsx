import type { Schemas } from '@afridev/api-client';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Code2,
  FolderGit2,
  GitPullRequest,
  MessagesSquare,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  WifiOff,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

import { buttonClasses, HubIcon, Logo } from '@/shared/ui';

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
  { href: '/hubs', label: 'Hubs' },
  { href: '/jobs', label: 'Jobs' },
];

const PILLARS = [
  {
    icon: Newspaper,
    title: 'Un fil technique, sans bruit',
    text: 'Retours d’expérience, déploiements, intégrations mobile money, sondages et vidéos courtes, réglés sur votre stack.',
    href: '/feed',
    cta: 'Voir le fil',
  },
  {
    icon: MessagesSquare,
    title: 'Entraide Q&A avec l’IA',
    text: 'Posez votre blocage à l’écrit ou à la voix : l’IA propose une première réponse en citant les solutions déjà validées par la communauté.',
    href: '/questions',
    cta: 'Parcourir les questions',
  },
  {
    icon: Code2,
    title: 'Un coffre à snippets',
    text: 'Commandes Docker, scripts USSD, requêtes SQL : gardés sur votre appareil et lisibles sans réseau. Une clé d’API collée par erreur est bloquée.',
    href: '/snippets',
    cta: 'Découvrir les snippets',
  },
  {
    icon: FolderGit2,
    title: 'Open source africain',
    text: 'Trouvez un projet qui recrute, prenez une première issue et laissez l’assistant vous présenter le dépôt.',
    href: '/projects',
    cta: 'Voir les projets',
  },
];

const STEPS = [
  {
    icon: UserPlus,
    title: 'Créez votre compte',
    text: 'Avec Google, GitHub ou une adresse e-mail. C’est gratuit et sans publicité.',
  },
  {
    icon: Sparkles,
    title: 'Réglez votre fil',
    text: 'Indiquez votre stack et vos objectifs : apprendre, aider, recruter ou trouver un projet.',
  },
  {
    icon: GitPullRequest,
    title: 'Participez',
    text: 'Posez une question, répondez, partagez un snippet ou contribuez à un projet de la communauté.',
  },
];

const FRUGAL = [
  {
    title: 'Mode « Texte seul »',
    text: 'Images et vidéos coupées en un clic, activé tout seul si la connexion est faible.',
  },
  {
    title: 'File d’attente hors ligne',
    text: 'Répondez sans réseau : vos envois partent dès que la connexion revient.',
  },
  {
    title: 'Brouillons à l’abri',
    text: 'Questions et réponses enregistrées toutes les 2 secondes : une coupure ne fait rien perdre.',
  },
  {
    title: 'Pas de lecture automatique',
    text: 'Aucune vidéo ne démarre sans vous : votre forfait sert à apprendre.',
  },
];

/** Section : petit sur-titre, titre, phrase d'accroche, lien « Tout voir ». */
function SectionHead({
  id,
  eyebrow,
  title,
  text,
  href,
  cta = 'Tout voir',
}: {
  id: string;
  eyebrow: string;
  title: string;
  text?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl space-y-1.5">
        <p className="text-label-md font-bold tracking-wide text-primary-ink uppercase">{eyebrow}</p>
        <h2 id={id} className="text-headline-lg text-ink sm:text-[1.75rem] sm:leading-9">
          {title}
        </h2>
        {text ? <p className="text-body-md text-ink-muted">{text}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-body-sm font-semibold text-primary-ink hover:underline">
          {cta} <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

/** Aperçu du produit, dessiné en HTML (0 image téléchargée) : une question et la réponse de l'IA. */
function ProductPreview() {
  return (
    <div className="relative" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_70%_30%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent)]" />
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--elev-raised)]">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="size-2.5 rounded-full bg-container-highest" />
          <span className="size-2.5 rounded-full bg-container-highest" />
          <span className="size-2.5 rounded-full bg-container-highest" />
          <span className="ml-2 text-label-md text-ink-faint">afridev · Q&amp;A</span>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {['django', 'mobile-money', 'webhook'].map((tag) => (
                <span key={tag} className="rounded-md bg-container px-2 py-0.5 font-mono text-[11px] text-ink-muted">
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-headline-md text-ink">Le webhook de paiement arrive deux fois, comment éviter le double crédit ?</p>
          </div>
          <div className="space-y-2 rounded-xl border border-line bg-container-low p-4">
            <p className="flex items-center gap-1.5 text-label-md font-semibold text-primary-ink">
              <Sparkles className="size-3.5" /> Première réponse de l’IA
            </p>
            <pre className="overflow-hidden rounded-lg bg-[var(--code-bg)] p-3 font-mono text-[12px] leading-5 text-[var(--code-ink)]">
              {[
                'tx, created = Payment.objects.get_or_create(',
                '    provider_ref=payload["id"],',
                '    defaults={"amount": payload["amount"]},',
                ')',
                'if not created: return 200  # déjà traité',
              ].map((line, index) => (
                <code key={index} className="block animate-type-in" style={{ animationDelay: `${300 + index * 160}ms` }}>
                  {line}
                </code>
              ))}
            </pre>
            <p className="text-body-sm text-ink-muted">Rendez le traitement idempotent avec la référence du fournisseur.</p>
          </div>
          <div className="flex items-center justify-between text-label-md text-ink-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-secondary-ink" /> Validée par la communauté
            </span>
            <span>3 réponses</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Page de présentation (« / ») pour les visiteurs : ce qu'est AfriDev, ce qu'on y trouve
 * (hubs, questions et projets réels, lus côté serveur), comment commencer.
 * Les membres connectés sont envoyés directement sur leur fil (script en tête de page).
 */
export function LandingScreen({ data }: { data: LandingData }) {
  const { hubs, questions, projects } = data;
  return (
    <div className="min-h-dvh bg-surface text-ink">
      {/* Bandeau d'annonce */}
      <div className="bg-ink px-4 py-2 text-center text-label-md text-surface">
        Gratuit et sans publicité, même en 2G.{' '}
        <Link href="/register" className="font-semibold underline underline-offset-2">
          Créer un compte
        </Link>
      </div>

      {/* En-tête */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="AfriDev, accueil">
            <Logo />
          </Link>
          <nav aria-label="Rubriques" className="hidden items-center gap-1 md:flex">
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
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--line-strong)_1px,transparent_1.2px)] [mask-image:linear-gradient(to_bottom,black,transparent)] bg-[length:22px_22px] opacity-60"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:pt-20 lg:pb-24">
            <div className="space-y-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-label-md font-semibold text-ink-muted">
                <span className="size-2 rounded-full bg-secondary" aria-hidden /> Le réseau des développeur·ses africain·es
              </p>
              <h1 className="text-[2.25rem] leading-[2.6rem] font-black tracking-tight text-ink sm:text-[3.25rem] sm:leading-[3.6rem]">
                Le code se partage.
                <br />
                <span className="text-primary">L’entraide se construit.</span>
              </h1>
              <p className="max-w-xl text-body-lg text-ink-muted">
                Posez vos questions, partagez vos snippets, contribuez à l’open source africain et trouvez votre
                prochaine mission, sur un site pensé pour les petites connexions.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/register" className={buttonClasses({ size: 'lg' })}>
                  Rejoindre gratuitement <ArrowRight className="size-5" aria-hidden />
                </Link>
                <Link href="/feed" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
                  Explorer sans compte
                </Link>
              </div>
              <dl className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: Zap, value: 'Gratuit', label: 'sans publicité' },
                  { icon: WifiOff, value: 'Hors ligne', label: 'lecture et envois' },
                  { icon: Sparkles, value: 'IA', label: 'réponse en secondes' },
                  { icon: ShieldCheck, value: 'Sécurisé', label: 'double authentification' },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={value} className="rounded-xl border border-line bg-card p-3">
                    <Icon className="mb-2 size-4 text-primary-ink" aria-hidden />
                    <dt className="sr-only">{label}</dt>
                    <dd>
                      <span className="block text-headline-md text-ink">{value}</span>
                      <span className="block text-label-md text-ink-muted">{label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <ProductPreview />
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-20 px-4 pb-20 sm:px-6 lg:space-y-24">
          {/* Communautés réelles */}
          {hubs.length ? (
            <section className="space-y-6" aria-labelledby="hubs">
              <SectionHead
                id="hubs"
                eyebrow="Communautés"
                title="Explorez par centre d’intérêt"
                text="Chaque hub réunit les devs d’une techno, d’un pays ou d’un métier."
                href="/hubs"
                cta="Tous les hubs"
              />
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {hubs.map((hub) => (
                  <li key={hub.id}>
                    <Link
                      href={`/h/${hub.slug}`}
                      className="group flex h-full items-center gap-3 rounded-xl border border-line bg-card p-4 transition-colors hover:border-line-strong hover:bg-container-low"
                    >
                      <HubIcon icon={hub.icon} name={hub.name} size={40} className="rounded-lg" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink group-hover:underline">{hub.name}</span>
                        <span className="block text-label-md text-ink-muted">
                          {compact.format(hub.member_count)} membre{hub.member_count > 1 ? 's' : ''}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Ce qu'on y fait */}
          <section className="space-y-6" aria-labelledby="piliers">
            <SectionHead id="piliers" eyebrow="La plateforme" title="Tout ce qu’il faut pour avancer, au même endroit" />
            <div className="grid gap-4 md:grid-cols-2">
              {PILLARS.map((pillar) => (
                <Link
                  key={pillar.title}
                  href={pillar.href}
                  className="group flex flex-col gap-3 rounded-2xl border border-line bg-card p-6 transition-colors hover:border-line-strong"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
                    <pillar.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-headline-md text-ink">{pillar.title}</h3>
                  <p className="text-body-md text-ink-muted">{pillar.text}</p>
                  <span className="mt-auto inline-flex items-center gap-1 text-body-sm font-semibold text-primary-ink group-hover:underline">
                    {pillar.cta} <ChevronRight className="size-4" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Activité réelle : questions et projets */}
          {questions.length || projects.length ? (
            <section className="grid gap-10 lg:grid-cols-2" aria-label="En ce moment sur AfriDev">
              {questions.length ? (
                <div className="space-y-5">
                  <SectionHead
                    id="questions"
                    eyebrow="En ce moment"
                    title="Des devs attendent votre aide"
                    href="/questions"
                    cta="Toutes les questions"
                  />
                  <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                    {questions.map((question) => (
                      <li key={question.id}>
                        <Link href={`/questions/${question.id}`} className="block space-y-1.5 p-4 transition-colors hover:bg-container-low">
                          <p className="line-clamp-2 font-semibold text-ink">{question.title}</p>
                          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label-md text-ink-muted">
                            <span>
                              {question.answer_count} réponse{question.answer_count > 1 ? 's' : ''}
                            </span>
                            {question.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="font-mono">
                                #{tag}
                              </span>
                            ))}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {projects.length ? (
                <div className="space-y-5">
                  <SectionHead
                    id="projets"
                    eyebrow="Open source"
                    title="Des projets qui recrutent"
                    href="/projects"
                    cta="Tous les projets"
                  />
                  <ul className="space-y-3">
                    {projects.map((project) => (
                      <li key={project.id}>
                        <Link
                          href={`/projects/${project.id}`}
                          className="block space-y-2 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-line-strong"
                        >
                          <p className="font-semibold text-ink">{project.name}</p>
                          {project.description ? (
                            <p className="line-clamp-2 text-body-sm text-ink-muted">{project.description}</p>
                          ) : null}
                          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-md text-ink-muted">
                            {project.language ? <span className="font-mono">{project.language}</span> : null}
                            <span className="flex items-center gap-1">
                              <Star className="size-3.5" aria-hidden /> {compact.format(project.stars)}
                            </span>
                            <span>
                              {project.open_issue_count} issue{project.open_issue_count > 1 ? 's' : ''} ouverte
                              {project.open_issue_count > 1 ? 's' : ''}
                            </span>
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Comment ça marche */}
          <section className="space-y-6" aria-labelledby="etapes">
            <SectionHead id="etapes" eyebrow="Pour commencer" title="Trois étapes, moins d’une minute" />
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative rounded-2xl border border-line bg-card p-6">
                  <span className="absolute top-5 right-5 font-mono text-label-md text-ink-faint">0{index + 1}</span>
                  <step.icon className="mb-4 size-6 text-primary-ink" aria-hidden />
                  <h3 className="mb-1.5 text-headline-md text-ink">{step.title}</h3>
                  <p className="text-body-sm text-ink-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Web économe */}
          <section
            className="grid gap-8 rounded-3xl bg-[var(--code-bg)] p-6 text-[var(--code-ink)] sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
            aria-labelledby="econome"
          >
            <div className="space-y-3">
              <p className="text-label-md font-bold tracking-wide text-[var(--sh-class)] uppercase">Notre engagement</p>
              <h2 id="econome" className="text-headline-lg sm:text-[1.75rem] sm:leading-9">
                Chaque octet doit servir à apprendre
              </h2>
              <p className="text-body-md text-[var(--code-faint)]">
                La data mobile coûte cher. AfriDev est conçu pour rester rapide et utile avec une connexion faible,
                instable ou absente.
              </p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2">
              {FRUGAL.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#3DDC84]" aria-hidden />
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-body-sm text-[var(--code-faint)]">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Appel final */}
          <section className="flex flex-col items-center gap-5 rounded-3xl border border-line bg-card px-6 py-14 text-center">
            <h2 className="max-w-2xl text-headline-lg sm:text-[2rem] sm:leading-10">Rejoignez la communauté dès aujourd’hui</h2>
            <p className="max-w-xl text-body-md text-ink-muted">
              Inscription gratuite avec Google, GitHub ou un e-mail. Votre fil se règle juste après.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/register" className={buttonClasses({ size: 'lg' })}>
                Créer mon compte <ArrowRight className="size-5" aria-hidden />
              </Link>
              <Link href="/login" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
                J’ai déjà un compte
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* Pied de page */}
      <footer className="border-t border-line bg-shell">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-body-sm text-ink-muted">
              Apprendre, s’entraider et contribuer entre développeur·ses africain·es, même avec une petite connexion.
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
              <p className="text-label-md font-bold tracking-wide text-ink uppercase">{column.title}</p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-body-sm text-ink-muted hover:text-ink hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-5 text-label-md text-ink-faint sm:px-6">
            © {new Date().getFullYear()} AfriDev Exchange
          </p>
        </div>
      </footer>
    </div>
  );
}
