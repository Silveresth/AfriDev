import { HandHelping, Sparkles, WifiOff } from 'lucide-react';

import { LogoMark } from '@/shared/ui';

const SNIPPET = [
  { tone: 'text-sky-300', text: 'const dev = await afridev.join({' },
  { tone: 'text-zinc-300', text: "  stack: ['django', 'flutter']," },
  { tone: 'text-zinc-300', text: "  goals: ['learn', 'help']," },
  { tone: 'text-emerald-300', text: '  offline: true, // 2G ok' },
  { tone: 'text-sky-300', text: '});' },
  { tone: 'text-amber-300', text: '// → fil « Pour vous » prêt ✦' },
];

const PERKS = [
  { icon: HandHelping, label: 'Entraide Q&A, réponse IA en quelques secondes' },
  { icon: Sparkles, label: 'Un fil qui suit votre stack et vos objectifs' },
  { icon: WifiOff, label: 'Pensé pour les petites connexions' },
];

/**
 * Colonne de présentation de l'écran de connexion : aucune image externe (0 octet téléchargé),
 * un « terminal » animé en CSS qui raconte ce qui se passe après l'inscription.
 */
export function AuthShowcase({ mode }: { mode: 'login' | 'register' }) {
  return (
    <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-zinc-950 p-8 text-white md:flex">
      <div
        className="pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-primary/35 blur-3xl motion-safe:animate-pulse"
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-20 bottom-10 size-72 rounded-full bg-secondary/25 blur-3xl" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1.2px)] bg-[length:18px_18px]"
        aria-hidden
      />

      <div className="relative flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
          <LogoMark size={26} />
        </span>
        <span className="text-xl font-black tracking-tight">
          afridev<span className="text-primary">.</span>
        </span>
      </div>

      <div className="relative space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl leading-tight font-black tracking-tight">
            {mode === 'login' ? 'Bon retour parmi les devs.' : 'Code. Entraide. Opportunités.'}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            {mode === 'login'
              ? 'Votre fil, vos snippets et vos discussions vous attendent.'
              : 'La communauté des développeur·ses africain·es, en 30 secondes.'}
          </p>
        </div>

        <figure className="overflow-hidden rounded-2xl bg-black/50 ring-1 ring-white/10 backdrop-blur" aria-hidden>
          <div className="flex items-center gap-1.5 border-b border-white/10 px-3.5 py-2.5">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-2 font-mono text-[11px] text-zinc-500">onboarding.ts</span>
          </div>
          <pre className="space-y-0.5 p-4 font-mono text-[12.5px] leading-6">
            {SNIPPET.map((line, index) => (
              <code
                key={index}
                className={`block animate-type-in ${line.tone}`}
                style={{ animationDelay: `${150 + index * 180}ms` }}
              >
                {line.text}
              </code>
            ))}
          </pre>
        </figure>

        <ul className="space-y-2.5">
          {PERKS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-sm text-zinc-300">
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                <Icon className="size-3.5 text-primary" aria-hidden />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-[11px] text-zinc-500">AfriDev Exchange © {new Date().getFullYear()}</p>
    </div>
  );
}
