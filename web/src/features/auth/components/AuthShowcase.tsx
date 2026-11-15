import { Bell, Code2, HandHelping, ShieldCheck, Sparkles, WifiOff } from 'lucide-react';

import { LogoMark } from '@/shared/ui';

/** Chaque mode raconte ce qui se passe vraiment après le bouton (inscription ≠ connexion). */
const CONTENT = {
  login: {
    title: 'Votre fil vous attend.',
    text: 'Reprenez vos discussions, vos questions et vos snippets là où vous les avez laissés.',
    file: 'session.ts',
    snippet: [
      { tone: 'text-sky-300', text: 'const me = await afridev.login();' },
      { tone: 'text-zinc-300', text: 'await me.sync(); // copie locale à jour' },
      { tone: 'text-emerald-300', text: '// → brouillons et snippets retrouvés' },
      { tone: 'text-amber-300', text: '// → notifications non lues : prêtes' },
    ],
    perks: [
      { icon: Bell, label: 'Réponses, mentions et messages en direct' },
      { icon: Code2, label: 'Vos snippets disponibles même hors ligne' },
      { icon: ShieldCheck, label: 'Double authentification si vous l’avez activée' },
    ],
  },
  register: {
    title: 'Code. Entraide. Opportunités.',
    text: 'La communauté des développeur·ses africain·es : un compte gratuit, sans publicité.',
    file: 'onboarding.ts',
    snippet: [
      { tone: 'text-sky-300', text: 'const dev = await afridev.join({' },
      { tone: 'text-zinc-300', text: "  stack: ['django', 'flutter']," },
      { tone: 'text-zinc-300', text: "  goals: ['learn', 'help']," },
      { tone: 'text-sky-300', text: '});' },
      { tone: 'text-amber-300', text: '// → fil « Pour vous » réglé sur votre stack' },
    ],
    perks: [
      { icon: HandHelping, label: 'Entraide Q&A, première réponse de l’IA en quelques secondes' },
      { icon: Sparkles, label: 'Un fil qui suit votre stack et vos objectifs' },
      { icon: WifiOff, label: 'Pensé pour les petites connexions' },
    ],
  },
} as const;

/**
 * Colonne de présentation de l'écran de connexion : aucune image externe (0 octet téléchargé),
 * un « terminal » animé en CSS qui raconte ce qui se passe après l'inscription.
 */
export function AuthShowcase({ mode }: { mode: 'login' | 'register' }) {
  const content = CONTENT[mode];
  return (
    <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-zinc-950 p-8 text-white md:flex">
      {/* Grille de fond subtile */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1.2px)] bg-[length:20px_20px]"
        aria-hidden
      />
      {/* Lueur blanche douce en haut à gauche */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 size-72 rounded-full bg-white/5 blur-3xl"
        aria-hidden
      />
      {/* Lueur blanc-bleutée en bas à droite */}
      <div
        className="pointer-events-none absolute -right-24 -bottom-16 size-64 rounded-full bg-sky-500/10 blur-3xl"
        aria-hidden
      />

      {/* Logo */}
      <div className="relative flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/10">
          <LogoMark size={26} />
        </span>
        <span className="text-xl font-black tracking-tight">
          afridev<span className="text-zinc-400">.</span>
        </span>
      </div>

      {/* Contenu central */}
      <div className="relative space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl leading-tight font-black tracking-tight">{content.title}</h2>
          <p className="text-sm leading-relaxed text-zinc-400">{content.text}</p>
        </div>

        <figure className="hidden overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/8 [@media(min-height:780px)]:block" aria-hidden>
          <div className="flex items-center gap-1.5 border-b border-white/8 px-3.5 py-2.5">
            <span className="size-2.5 rounded-full bg-zinc-600" />
            <span className="size-2.5 rounded-full bg-zinc-600" />
            <span className="size-2.5 rounded-full bg-zinc-600" />
            <span className="ml-2 font-mono text-[11px] text-zinc-500">{content.file}</span>
          </div>
          <pre className="space-y-0.5 p-4 font-mono text-[12.5px] leading-6">
            {content.snippet.map((line, index) => (
              <code
                key={`${mode}-${index}`}
                className={`block animate-type-in ${line.tone}`}
                style={{ animationDelay: `${150 + index * 180}ms` }}
              >
                {line.text}
              </code>
            ))}
          </pre>
        </figure>

        <ul className="space-y-2.5">
          {content.perks.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-sm text-zinc-300">
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/6 ring-1 ring-white/10">
                <Icon className="size-3.5 text-zinc-300" aria-hidden />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-[11px] text-zinc-600">AfriDev Exchange © {new Date().getFullYear()}</p>
    </div>
  );
}
