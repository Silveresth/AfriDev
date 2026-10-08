import {
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Code2,
  Compass,
  FolderGit2,
  Home,
  type LucideIcon,
  MessagesSquare,
  UserRound,
  UsersRound,
} from 'lucide-react';

import type { MessageKey } from '@/shared/i18n';
import { cn } from '@/shared/lib';

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  msgKey?: MessageKey;
  shortKey?: MessageKey;
  /** Raccourci clavier « G puis touche » (façon GitHub / Linear). */
  key?: string;
  /** Rubrique annoncée mais pas encore livrée : affichée grisée avec « Bientôt ». */
  soon?: boolean;
}

/** Raccourcis de la colonne de gauche, dans l'ordre d'affichage. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/feed', label: 'Accueil', short: 'Accueil', icon: Home, key: 'h', msgKey: 'nav.home', shortKey: 'nav.home' },
  { href: '/search', label: 'Explorer', short: 'Explorer', icon: Compass, key: 'e', msgKey: 'nav.search', shortKey: 'nav.search' },
  { href: '/hubs', label: 'Hubs', short: 'Hubs', icon: UsersRound, key: 'u', msgKey: 'nav.hubs', shortKey: 'nav.hubs' },
  { href: '/questions', label: 'Q&A', short: 'Q&A', icon: MessagesSquare, key: 'q', msgKey: 'nav.questions', shortKey: 'nav.questions' },
  { href: '/snippets', label: 'Snippets', short: 'Snippets', icon: Code2, key: 's', msgKey: 'nav.snippets', shortKey: 'nav.snippets' },
  { href: '/projects', label: 'Projets', short: 'Projets', icon: FolderGit2, key: 'p', msgKey: 'nav.projects', shortKey: 'nav.projects' },
  { href: '/jobs', label: 'Job Board', short: 'Jobs', icon: BriefcaseBusiness, key: 'j', msgKey: 'nav.jobs', shortKey: 'nav.jobs' },
  { href: '/events', label: 'Événements', short: 'Événements', icon: CalendarDays, key: 'v', msgKey: 'nav.events', shortKey: 'nav.events' },
  { href: '/bookmarks', label: 'Marque-pages', short: 'Favoris', icon: Bookmark, key: 'b', msgKey: 'nav.bookmarks', shortKey: 'nav.bookmarks' },
  { href: '/profile', label: 'Profil', short: 'Profil', icon: UserRound, key: 'm', msgKey: 'nav.profile', shortKey: 'nav.profile' },
];

export interface NavSection {
  title: string | null;
  msgKey?: MessageKey;
  hrefs: string[];
}

/** Regroupement de la colonne de gauche : communauté, savoir partagé, carrière, espace perso. */
export const NAV_SECTIONS: NavSection[] = [
  { title: null, hrefs: ['/feed', '/search', '/hubs'] },
  { title: 'Savoir', msgKey: 'nav.section.know', hrefs: ['/questions', '/snippets', '/projects'] },
  { title: 'Carrière', msgKey: 'nav.section.career', hrefs: ['/jobs', '/events'] },
  { title: 'Mon espace', msgKey: 'nav.section.my_space', hrefs: ['/bookmarks', '/profile'] },
];

const byHref = (href: string) => NAV_ITEMS.find((item) => item.href === href)!;

/** Barre d'onglets du téléphone : 4 rubriques + « Créer » au centre, à portée du pouce. */
export const MOBILE_TABS: Array<NavItem | null> = [
  byHref('/feed'),
  byHref('/questions'),
  null,
  byHref('/hubs'),
  byHref('/profile'),
];

export interface PublishItem {
  href: string;
  label: string;
  hint: string;
  msgKey?: MessageKey;
  hintKey?: MessageKey;
}

export const PUBLISH_ITEMS: PublishItem[] = [
  { href: '/submit', label: 'Un post', hint: 'Astuce, code, sondage, image, vidéo', msgKey: 'publish.post', hintKey: 'publish.post_hint' },
  { href: '/questions/new', label: 'Une question', hint: "Première réponse de l'IA en quelques secondes", msgKey: 'publish.question', hintKey: 'publish.question_hint' },
  { href: '/snippets/new', label: 'Un snippet', hint: 'Dans votre coffre, disponible hors ligne', msgKey: 'publish.snippet', hintKey: 'publish.snippet_hint' },
  { href: '/projects/new', label: 'Un projet open source', hint: 'Trouvez des contributeurs', msgKey: 'publish.project', hintKey: 'publish.project_hint' },
];

/** Lien de la colonne de gauche (rubriques, hubs) : pilule teintée pour la page en cours. */
export function navItemClasses(active: boolean) {
  return cn(
    'group relative flex h-9 items-center gap-3 rounded-full text-[0.875rem] transition-colors',
    active
      ? 'bg-primary-soft font-semibold text-primary-ink'
      : 'font-medium text-ink-muted hover:bg-shell-hover hover:text-ink',
  );
}

/** Ma page publique (/u/<moi>) compte comme la rubrique « Profil » de la navigation. */
export function navPath(pathname: string, username?: string) {
  return username && pathname.toLowerCase() === `/u/${username.toLowerCase()}` ? '/profile' : pathname;
}

export function isActive(pathname: string, href: string) {
  const base = href.split('?')[0] ?? href;
  return pathname === base || pathname.startsWith(`${base}/`);
}
