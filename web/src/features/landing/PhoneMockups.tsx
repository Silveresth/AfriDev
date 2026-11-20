import {
  ArrowBigUp,
  BatteryFull,
  Bell,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  Code2,
  Home,
  MessageCircle,
  MessagesSquare,
  Mic,
  Newspaper,
  Plus,
  Search,
  SendHorizontal,
  Share2,
  Signal,
  Sparkles,
  UserRound,
  UsersRound,
  Wifi,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Écrans de l'application mobile native (Expo), redessinés en HTML à partir des vrais écrans :
 * Accueil (FeedScreen : « Pour vous / Abonnements », filtres, cartes typées, bouton « + »,
 * barre d'onglets) et une Question avec la réponse de l'IA, en thème sombre.
 * Couleurs = jetons de mobile/src/shared/theme/tokens.ts, fixes quel que soit le thème du site.
 */

function Frame({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`relative w-[17.5rem] rounded-[2.75rem] bg-[#1c1c1f] p-[0.55rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.08),inset_0_0_0_1.5px_rgba(255,255,255,0.06)] ${className ?? ''}`}
      style={style}
    >
      {/* Boutons latéraux */}
      <span className="absolute top-24 -left-[3px] h-8 w-[3px] rounded-l bg-[#2a2a2e]" />
      <span className="absolute top-36 -left-[3px] h-12 w-[3px] rounded-l bg-[#2a2a2e]" />
      <span className="absolute top-32 -right-[3px] h-16 w-[3px] rounded-r bg-[#2a2a2e]" />
      <div className="relative h-[36rem] overflow-hidden rounded-[2.25rem]">{children}</div>
    </div>
  );
}

function StatusBar({ dark }: { dark?: boolean }) {
  return (
    <div className={`relative flex h-11 items-center justify-between px-6 pt-1 text-[12px] font-semibold ${dark ? 'text-[#EDEDEF]' : 'text-[#0A0A0B]'}`}>
      <span>9:41</span>
      <span className="absolute top-2.5 left-1/2 h-[1.4rem] w-[5.5rem] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-1">
        <Signal className="size-3.5" strokeWidth={2.5} />
        <Wifi className="size-3.5" strokeWidth={2.5} />
        <BatteryFull className="size-4" strokeWidth={2} />
      </span>
    </div>
  );
}

function Dot({ count }: { count: number }) {
  return (
    <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#C84B20] px-1 text-[8px] leading-none font-bold text-white">
      {count}
    </span>
  );
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
      {initials}
    </span>
  );
}

/** Écran « Accueil » de l'appli, thème clair. */
export function FeedPhone({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <Frame className={className} style={style}>
      <div className="flex h-full flex-col bg-white text-[#0A0A0B]">
        <StatusBar />
        {/* En-tête « AfriDev » + actions */}
        <div className="flex items-center justify-between px-4 pt-1 pb-2">
          <span className="text-[22px] leading-7 font-bold tracking-tight">AfriDev</span>
          <span className="flex items-center gap-3.5 text-[#0A0A0B]">
            <Sparkles className="size-[18px]" strokeWidth={1.9} />
            <Search className="size-[18px]" strokeWidth={1.9} />
            <span className="relative">
              <MessageCircle className="size-[18px]" strokeWidth={1.9} />
              <Dot count={2} />
            </span>
            <span className="relative">
              <Bell className="size-[18px]" strokeWidth={1.9} />
              <Dot count={5} />
            </span>
          </span>
        </div>
        {/* Pour vous / Abonnements */}
        <div className="flex gap-1 border-b border-[#E6E6E9] px-3 text-[12px]">
          <span className="border-b-2 border-[#0A0A0B] px-2.5 py-2.5 font-semibold">Pour vous</span>
          <span className="border-b-2 border-transparent px-2.5 py-2.5 font-semibold text-[#52525B]">Abonnements</span>
        </div>
        {/* Filtres */}
        <div className="flex gap-1.5 overflow-hidden px-3 py-2.5 text-[11px] font-semibold whitespace-nowrap">
          <span className="rounded-full bg-[#0A0A0B] px-3 py-1 text-white">Tout</span>
          <span className="rounded-full bg-[#F0F0F2] px-3 py-1 text-[#52525B]">Posts</span>
          <span className="rounded-full bg-[#F0F0F2] px-3 py-1 text-[#52525B]">Entraide</span>
          <span className="rounded-full bg-[#F0F0F2] px-3 py-1 text-[#52525B]">Snippets</span>
          <span className="rounded-full bg-[#F0F0F2] px-3 py-1 text-[#52525B]">Projets</span>
        </div>

        {/* Carte « Entraide » */}
        <div className="space-y-1.5 border-b border-[#E6E6E9] px-4 py-3">
          <div className="flex items-center gap-2">
            <Avatar initials="AD" color="#1A7F4B" />
            <span className="min-w-0 flex-1 truncate text-[11px]">
              <b className="font-semibold">Aminata Diallo</b> <span className="text-[#75757E]">· 12 min</span>
            </span>
            <span className="flex items-center gap-1 rounded-md bg-[#15803D1F] px-1.5 py-0.5 text-[10px] font-bold text-[#15803D]">
              <MessagesSquare className="size-3" /> Entraide
            </span>
          </div>
          <p className="text-[13px] leading-[18px] font-semibold">Webhook Wave reçu deux fois : comment éviter le double crédit ?</p>
          <p className="line-clamp-2 text-[11.5px] leading-4 text-[#52525B]">
            Mon endpoint Django crédite le compte à chaque appel, et le fournisseur renvoie parfois le même événement…
          </p>
          <div className="flex items-center gap-2 pt-0.5 text-[10.5px]">
            <span className="flex items-center gap-1 rounded-md bg-[#FCEBE4] px-1.5 py-0.5 font-medium text-[#A63306]">
              <Sparkles className="size-2.5" /> Pour vous
            </span>
            <span className="font-mono text-[#52525B]">#django</span>
            <span className="font-mono text-[#52525B]">#mobile-money</span>
          </div>
          <div className="flex items-center gap-4 pt-1 text-[11px] font-semibold text-[#52525B]">
            <span className="flex items-center gap-1 text-[#C84B20]">
              <ArrowBigUp className="size-4 fill-current" /> 24
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3.5" /> 5
            </span>
            <Share2 className="size-3.5" />
          </div>
        </div>

        {/* Carte « Snippet » */}
        <div className="space-y-1.5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Avatar initials="KO" color="#2563EB" />
            <span className="min-w-0 flex-1 truncate text-[11px]">
              <b className="font-semibold">Kwame Owusu</b> <span className="text-[#75757E]">· 1 h</span>
            </span>
            <span className="flex items-center gap-1 rounded-md bg-[#0284C71F] px-1.5 py-0.5 text-[10px] font-bold text-[#0284C7]">
              <Code2 className="size-3" /> Snippet
            </span>
          </div>
          <p className="text-[13px] leading-[18px] font-semibold">Retry exponentiel pour l’API M-Pesa</p>
          <pre className="overflow-hidden rounded-lg bg-[#0D1117] px-2.5 py-2 font-mono text-[9.5px] leading-[14px] text-[#E6EDF3]">
            <span className="text-[#ff7b72]">for</span> attempt <span className="text-[#ff7b72]">in</span> range(<span className="text-[#79c0ff]">5</span>):{'\n'}
            {'  '}res = mpesa.stk_push(order){'\n'}
            {'  '}<span className="text-[#ff7b72]">if</span> res.ok: <span className="text-[#ff7b72]">break</span>{'\n'}
            {'  '}sleep(<span className="text-[#79c0ff]">2</span> ** attempt)
          </pre>
        </div>

        {/* Bouton rond « + » */}
        <span className="absolute right-4 bottom-[4.6rem] flex size-12 items-center justify-center rounded-full bg-[#C84B20] text-white shadow-[0_8px_20px_-4px_rgba(200,75,32,0.6)]">
          <Plus className="size-6" strokeWidth={2.4} />
        </span>

        {/* Barre d'onglets */}
        <div className="mt-auto grid grid-cols-5 border-t border-[#E6E6E9] bg-white px-1 pt-1.5 pb-5 text-[9.5px] font-semibold">
          {[
            { icon: Home, label: 'Accueil', active: true },
            { icon: Newspaper, label: 'Actu tech' },
            { icon: MessagesSquare, label: 'Q&A' },
            { icon: UsersRound, label: 'Hubs' },
            { icon: UserRound, label: 'Profil' },
          ].map(({ icon: Icon, label, active }) => (
            <span key={label} className={`flex flex-col items-center gap-0.5 ${active ? 'text-[#C84B20]' : 'text-[#75757E]'}`}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-[#FCEBE4]' : ''}`}>
                <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 1.9} />
              </span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Écran « Question » avec la réponse de l'IA, thème sombre, et une notification qui arrive. */
export function QuestionPhone({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <Frame className={className} style={style}>
      <div className="flex h-full flex-col bg-[#09090B] text-[#EDEDEF]">
        <StatusBar dark />

        {/* Notification en direct */}
        <div className="absolute inset-x-2.5 top-12 z-10 flex animate-float items-center gap-2.5 rounded-2xl border border-white/10 bg-[#1B1B1F]/95 p-2.5 shadow-[0_12px_30px_-6px_rgba(0,0,0,0.8)] backdrop-blur">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#C84B20]">
            <svg viewBox="0 0 120 120" className="size-5" aria-hidden>
              <path d="M48 38L26 60L48 82" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M72 38L94 60L72 82" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </span>
          <span className="min-w-0 flex-1 text-[10.5px] leading-[14px]">
            <span className="flex justify-between font-semibold">
              AfriDev <span className="font-normal text-[#7A7A83]">maintenant</span>
            </span>
            <span className="block truncate text-[#A1A1AA]">Fatou a répondu à votre question</span>
          </span>
        </div>

        {/* En-tête */}
        <div className="flex items-center justify-between px-3 pt-1 pb-2">
          <ChevronLeft className="size-5" />
          <span className="text-[14px] font-semibold">Question</span>
          <span className="flex gap-3">
            <Bookmark className="size-4" />
            <Share2 className="size-4" />
          </span>
        </div>

        <div className="space-y-3 overflow-hidden px-4 pt-2">
          <div className="flex flex-wrap gap-1">
            {['flutter', 'orange-money', 'android'].map((tag) => (
              <span key={tag} className="rounded-md bg-[#1B1B1F] px-1.5 py-0.5 font-mono text-[9.5px] text-[#A1A1AA]">
                {tag}
              </span>
            ))}
          </div>
          <p className="text-[15px] leading-5 font-bold tracking-tight">Écran blanc au retour du paiement Orange Money, une idée ?</p>
          <p className="text-[10.5px] text-[#7A7A83]">Yao K. · Abidjan · il y a 25 min</p>

          {/* Réponse de l'IA */}
          <div className="space-y-2 rounded-xl border border-[#2B1710] bg-[#2B1710]/60 p-3">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-[#FF9B76]">
              <Sparkles className="size-3" /> Première réponse de l’IA · 4 s
            </p>
            <p className="text-[11px] leading-[15px] text-[#D4D4D8]">
              L’activité est recréée au retour du navigateur. Restaurez l’état avec le lien profond :
            </p>
            <pre className="overflow-hidden rounded-lg bg-[#0A0D12] px-2.5 py-2 font-mono text-[9.5px] leading-[14px] text-[#E6EDF3]">
              <span className="text-[#ff7b72]">final</span> link = <span className="text-[#ff7b72]">await</span>{'\n'}
              {'  '}AppLinks().getInitialLink();{'\n'}
              <span className="text-[#ff7b72]">if</span> (link != <span className="text-[#79c0ff]">null</span>) _resume(link);
            </pre>
            <p className="text-[9.5px] text-[#7A7A83]">D’après 2 solutions validées par la communauté</p>
          </div>

          {/* Réponse acceptée */}
          <div className="space-y-1.5 rounded-xl border border-[#232328] bg-[#111113] p-3">
            <div className="flex items-center gap-2">
              <Avatar initials="FS" color="#7C3AED" />
              <span className="flex-1 text-[11px] font-semibold">Fatou Sow</span>
              <span className="flex items-center gap-1 rounded-md bg-[#0F2A1B] px-1.5 py-0.5 text-[9.5px] font-bold text-[#6FD59C]">
                <CheckCircle2 className="size-3" /> Acceptée
              </span>
            </div>
            <p className="line-clamp-2 text-[11px] leading-[15px] text-[#A1A1AA]">
              Ajoutez aussi <code className="font-mono text-[#FF9B76]">launchMode=&quot;singleTask&quot;</code> dans le manifeste, sinon…
            </p>
            <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#D4572A]">
              <ArrowBigUp className="size-4 fill-current" /> 18
            </span>
          </div>
        </div>

        {/* Zone de réponse */}
        <div className="mt-auto flex items-center gap-2 border-t border-[#232328] bg-[#09090B] px-3 pt-2.5 pb-6">
          <span className="flex h-9 flex-1 items-center rounded-full bg-[#1B1B1F] px-3.5 text-[11px] text-[#7A7A83]">Votre réponse…</span>
          <Mic className="size-4 text-[#A1A1AA]" />
          <span className="flex size-9 items-center justify-center rounded-full bg-[#D4572A]">
            <SendHorizontal className="size-4 text-white" />
          </span>
        </div>
      </div>
    </Frame>
  );
}
