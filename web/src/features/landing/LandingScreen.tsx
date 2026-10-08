import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Code2,
  Eye,
  FolderGit2,
  Keyboard,
  MessagesSquare,
  Newspaper,
  ShieldCheck,
  Sparkles,
  WifiOff,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

import { buttonClasses, Card, StatusBadge } from '@/shared/ui';

const PILLARS = [
  {
    icon: Newspaper,
    title: "Fil d'actualité épuré & technique",
    meta: 'Chronologique · sans algorithme',
    text: "Partagez vos retours d'expérience : déploiements, intégrations mobile money (Wave, Orange Money, Moov, MTN MoMo), sondages et vidéos courtes.",
    href: '/feed',
    cta: 'Voir le fil',
  },
  {
    icon: MessagesSquare,
    title: 'Entraide communautaire & IA',
    meta: 'Réponse IA instantanée · validation par les pairs',
    text: "Posez votre blocage, à l'écrit ou à la voix. L'IA propose une première réponse en quelques secondes, en citant les solutions déjà validées par la communauté.",
    href: '/questions',
    cta: 'Poser une question',
  },
  {
    icon: Code2,
    title: 'Coffre-fort de snippets hors ligne',
    meta: 'Sur votre appareil · Security Guard',
    text: "Gardez vos commandes Docker, scripts USSD et requêtes SQL sous la main, même sans réseau. Les clés d'API sont bloquées avant tout envoi.",
    href: '/snippets',
    cta: 'Ouvrir mon coffre',
  },
  {
    icon: FolderGit2,
    title: "Projets open source d'Afrique",
    meta: 'Good first issues · guide de démarrage IA',
    text: 'Trouvez des projets qui correspondent à votre stack, prenez une première issue et laissez l’agent vous expliquer le dépôt.',
    href: '/projects',
    cta: 'Découvrir les projets',
  },
];

const MANIFESTO = [
  {
    title: 'Mode « Texte seul » en un clic',
    text: 'Images, vidéos et polices décoratives désactivées : la page devient aussi légère qu’un SMS.',
  },
  {
    title: 'File d’attente hors ligne',
    text: 'Répondez dans le bus ou sans crédit : tout part dès que votre antenne capte à nouveau.',
  },
  {
    title: 'Aucun traqueur, aucune vidéo automatique',
    text: 'Pas de publicité, pas de lecture automatique : votre forfait sert à apprendre.',
  },
];

export function LandingScreen() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <StatusBadge tone="success">PWA ultra-légère · conçue pour la 2G, la 3G et les coupures</StatusBadge>
          <h1 className="text-headline-xl text-ink sm:text-[2.75rem] sm:leading-[3.25rem]">
            Apprendre, s&apos;entraider et contribuer,{' '}
            <span className="text-primary">même avec une petite connexion.</span>
          </h1>
          <p className="max-w-2xl text-body-lg text-ink-muted">
            Le réseau des développeurs africains : assistance IA instantanée, synchronisation hors ligne
            automatique et open source panafricain, sans gaspiller votre forfait.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className={buttonClasses({ size: 'lg' })}>
              Rejoindre la communauté gratuitement <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link href="/feed" className={buttonClasses({ variant: 'ghost', size: 'lg' })}>
              <Eye className="size-5" aria-hidden /> Explorer en invité
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-body-sm text-ink-muted">
            <li className="flex items-center gap-1.5"><Zap className="size-4 text-primary-ink" aria-hidden /> Pages légères</li>
            <li className="flex items-center gap-1.5"><WifiOff className="size-4 text-primary-ink" aria-hidden /> Utilisable hors ligne</li>
            <li className="flex items-center gap-1.5"><Keyboard className="size-4 text-primary-ink" aria-hidden /> Accessible au clavier</li>
          </ul>
        </div>
        <Card className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-headline-md">
            <WifiOff className="size-5 text-primary-ink" aria-hidden /> Pensé pour le terrain
          </h2>
          {[
            ['Copie locale', 'Les écrans s’affichent tout de suite depuis votre appareil, puis se mettent à jour en arrière-plan.'],
            ['Brouillons à l’abri', 'Questions et réponses sont enregistrées toutes les 2 secondes : une coupure ne fait rien perdre.'],
            ['Security Guard', 'Une clé d’API collée par erreur est bloquée sur l’appareil, même hors ligne.'],
          ].map(([title, text]) => (
            <div key={title} className="flex gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-secondary-ink" aria-hidden />
              <div>
                <p className="font-semibold text-ink">{title}</p>
                <p className="text-body-sm text-ink-muted">{text}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section className="space-y-6" aria-labelledby="piliers">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-label-md font-bold tracking-wide uppercase text-primary-ink">Architecture terrain</p>
            <h2 id="piliers" className="text-headline-lg">Les 4 piliers d&apos;une plateforme résiliente</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} className="flex flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-container-low text-primary-ink">
                  <pillar.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-headline-md">{pillar.title}</h3>
                  <p className="text-label-md text-ink-muted">{pillar.meta}</p>
                </div>
              </div>
              <p className="text-body-md text-ink-muted">{pillar.text}</p>
              <Link href={pillar.href} className="mt-auto inline-flex items-center gap-1 self-end text-body-sm font-semibold text-primary-ink hover:underline">
                {pillar.cta} <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-8 rounded-lg border border-line bg-container-low p-6 lg:grid-cols-2" aria-labelledby="manifeste">
        <div className="space-y-3">
          <p className="text-label-md font-bold tracking-wide uppercase text-secondary-ink">Notre engagement</p>
          <h2 id="manifeste" className="text-headline-lg">Le manifeste du web économe pour l&apos;Afrique</h2>
          <p className="text-body-md text-ink-muted">
            En Afrique subsaharienne, la data mobile coûte cher. Chaque octet chargé par AfriDev doit
            servir à apprendre, à aider ou à construire.
          </p>
        </div>
        <ul className="space-y-4">
          {MANIFESTO.map((item) => (
            <li key={item.title} className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-secondary-ink" aria-hidden />
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-body-sm text-ink-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col items-center gap-4 rounded-lg border border-line bg-card px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-lg bg-primary text-on-primary">
          <Sparkles className="size-6" aria-hidden />
        </span>
        <h2 className="max-w-2xl text-headline-lg">Prêt à coder plus vite sans vous soucier de votre forfait ?</h2>
        <p className="max-w-xl text-body-md text-ink-muted">
          Créez votre profil en quelques secondes avec GitHub, votre numéro de téléphone ou un e-mail.
        </p>
        <Link href="/login" className={buttonClasses({ size: 'lg' })}>
          Créer mon compte <ArrowRight className="size-5" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
