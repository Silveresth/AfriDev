import { Bell, CheckCircle2, Code2, HandHelping, ShieldCheck, Sparkles, WifiOff } from 'lucide-react';

import { CodeGlobe } from '@/features/landing';

/** Chaque mode raconte ce qui se passe vraiment après le bouton (inscription ≠ connexion). */
const CONTENT = {
  login: {
    eyebrow: 'Bon retour',
    title: 'Votre fil vous attend.',
    text: 'Reprenez vos discussions, vos questions et vos snippets là où vous les avez laissés.',
    perks: [
      { icon: Bell, label: 'Réponses et mentions en direct' },
      { icon: Code2, label: 'Snippets disponibles hors ligne' },
      { icon: ShieldCheck, label: 'Double authentification' },
    ],
  },
  register: {
    eyebrow: 'Gratuit, sans publicité',
    title: 'Bloqué sur du code ? L’Afrique tech vous répond.',
    text: 'Rejoignez les développeur·ses africain·es qui s’entraident chaque jour.',
    perks: [
      { icon: HandHelping, label: 'Première réponse de l’IA en secondes' },
      { icon: Sparkles, label: 'Un fil réglé sur votre stack' },
      { icon: WifiOff, label: 'Pensé pour les petites connexions' },
    ],
  },
} as const;

/**
 * Colonne de présentation de la connexion (page et fenêtre modale) : panneau sombre, globe en code
 * (canvas, 0 octet téléchargé) et ce que le compte apporte. Masquée sur téléphone.
 */
export function AuthShowcase({ mode }: { mode: 'login' | 'register' }) {
  const content = CONTENT[mode];
  return (
    <div className="relative isolate hidden w-[46%] shrink-0 flex-col justify-end overflow-hidden bg-[#07090d] p-9 text-[#EDEDEF] md:flex" aria-hidden>
      {/* Lueurs et grille */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -right-24 size-[26rem] rounded-full bg-[radial-gradient(closest-side,rgba(200,75,32,0.32),transparent)] blur-2xl" />
        <div className="absolute -bottom-32 -left-24 size-[22rem] rounded-full bg-[radial-gradient(closest-side,rgba(26,127,75,0.22),transparent)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] bg-[size:40px_40px]" />
      </div>

      {/* Globe : l'Afrique en code */}
      <div className="absolute top-[-6%] left-1/2 aspect-square w-[118%] -translate-x-1/2 [mask-image:linear-gradient(to_bottom,black_55%,transparent_88%)]">
        <CodeGlobe forceDark className="size-full" />
      </div>

      {/* Carte flottante */}
      <div className="absolute top-[30%] right-7 flex animate-float items-center gap-2.5 rounded-2xl border border-white/10 bg-[#111113]/85 py-2 pr-3.5 pl-2 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.8)] backdrop-blur-md">
        <span className="flex size-8 items-center justify-center rounded-xl bg-[#0F2A1B] text-[#6FD59C]">
          <CheckCircle2 className="size-4" />
        </span>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold">Réponse validée</span>
          <span className="block text-[11px] text-[#A1A1AA]">Lagos · il y a 2 min</span>
        </span>
      </div>

      {/* Texte */}
      <div key={mode} className="relative space-y-5">
        <div className="space-y-2.5">
          <p className="animate-rise text-[11px] font-bold tracking-[0.16em] text-[#FF9B76] uppercase">{content.eyebrow}</p>
          <h2 className="animate-rise text-[1.875rem] leading-[1.1] font-black tracking-[-0.035em] text-balance" style={{ animationDelay: '60ms' }}>
            {content.title}
          </h2>
          <p className="animate-rise text-[0.9375rem] leading-6 text-[#A1A1AA]" style={{ animationDelay: '120ms' }}>
            {content.text}
          </p>
        </div>
        <ul className="flex animate-rise flex-wrap gap-2" style={{ animationDelay: '180ms' }}>
          {content.perks.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] text-[#D4D4D8]">
              <Icon className="size-3.5 text-[#FF9B76]" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
