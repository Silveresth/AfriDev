'use client';

import {
  BellOff,
  BookOpen,
  Check,
  CheckCheck,
  CheckCircle2,
  EyeOff,
  Handshake,
  Heart,
  type LucideIcon,
  MessageSquare,
  MessagesSquare,
  MoreHorizontal,
  Reply,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/shared/lib';
import { Button, ErrorNotice, Menu, MenuItem, MenuSeparator, Skeleton, TimeAgo } from '@/shared/ui';

import {
  type Notification,
  notificationHref,
  useClearNotifications,
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '../api';

const KIND_STYLE: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  new_comment: { icon: MessageSquare, tone: 'bg-container text-ink-muted', label: 'Commentaire' },
  comment_reply: { icon: Reply, tone: 'bg-container text-ink-muted', label: 'Réponse à un commentaire' },
  post_liked: { icon: Heart, tone: 'bg-primary-soft text-primary-ink', label: 'J’aime' },
  new_answer: { icon: MessagesSquare, tone: 'bg-primary-soft text-primary-ink', label: 'Réponse' },
  answer_accepted: { icon: CheckCircle2, tone: 'bg-secondary-soft text-on-secondary-soft', label: 'Réponse acceptée' },
  ai_answer_ready: { icon: Sparkles, tone: 'bg-primary text-on-primary', label: 'Réponse de l’IA' },
  snippet_flagged: { icon: ShieldAlert, tone: 'bg-danger-soft text-danger', label: 'Sécurité' },
  content_hidden: { icon: EyeOff, tone: 'bg-danger-soft text-danger', label: 'Modération' },
  guide_ready: { icon: BookOpen, tone: 'bg-secondary-soft text-on-secondary-soft', label: 'Guide d’onboarding' },
  application_received: { icon: UserPlus, tone: 'bg-secondary-soft text-on-secondary-soft', label: 'Candidature' },
  application_answered: { icon: Handshake, tone: 'bg-container text-ink-muted', label: 'Candidature' },
};

function groupOf(date: string): string {
  const age = Date.now() - new Date(date).getTime();
  if (age < 24 * 3600 * 1000) return "Aujourd'hui";
  if (age < 7 * 24 * 3600 * 1000) return 'Cette semaine';
  return 'Plus ancien';
}

/**
 * Centre de notifications : onglets toutes / non lues, ouverture (marque comme lue puis mène au
 * contenu, ou déplie le texte complet), et actions unitaires ou globales (tout lire, tout effacer).
 */
export function NotificationPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const { data: unread = 0 } = useUnreadCount();
  const list = useNotifications(tab === 'unread');
  const markAll = useMarkAllRead();
  const clear = useClearNotifications();

  const groups = new Map<string, Notification[]>();
  for (const notification of list.items) {
    const group = groupOf(notification.created_at);
    groups.set(group, [...(groups.get(group) ?? []), notification]);
  }

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Notifications"
      className={cn(
        'animate-pop fixed inset-x-2 top-[4.25rem] z-40 flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-raised',
        'sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2.5 sm:max-h-[min(40rem,calc(100dvh-6rem))] sm:w-[26rem]',
      )}
    >
      <header className="border-b border-line px-4 pt-3.5">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-headline-md text-ink">Notifications</h2>
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={!unread}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-body-sm font-medium text-ink-muted transition-colors hover:bg-container hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            <CheckCheck className="size-4" aria-hidden /> Tout lire
          </button>
          <Menu
            className="w-60"
            trigger={(props) => (
              <button
                type="button"
                aria-label="Plus d’actions"
                title="Plus d’actions"
                {...props}
                className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-container hover:text-ink"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </button>
            )}
          >
            <MenuItem onSelect={() => markAll.mutate()}>
              <CheckCheck aria-hidden /> Tout marquer comme lu
            </MenuItem>
            <MenuItem href="/settings">
              <Settings2 aria-hidden /> Gérer les notifications
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={() => setConfirmClear(true)}>
              <Trash2 aria-hidden /> Tout effacer
            </MenuItem>
          </Menu>
        </div>
        <div role="tablist" className="mt-2 flex gap-5">
          {(
            [
              { value: 'all', label: 'Toutes' },
              { value: 'unread', label: 'Non lues', count: unread },
            ] as const
          ).map((option) => {
            const active = tab === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(option.value)}
                className={cn(
                  'relative flex h-9 items-center gap-1.5 text-body-sm font-medium transition-colors',
                  active ? 'text-ink' : 'text-ink-faint hover:text-ink-muted',
                )}
              >
                {option.label}
                {'count' in option && option.count ? (
                  <span className="rounded-full bg-primary-soft px-1.5 text-label-sm font-semibold text-primary-ink tabular-nums">
                    {option.count}
                  </span>
                ) : null}
                {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </header>

      {confirmClear ? (
        <div role="alertdialog" aria-label="Tout effacer" className="flex items-center gap-3 border-b border-line bg-danger-soft/60 px-4 py-3">
          <p className="flex-1 text-body-sm text-on-danger-soft">Effacer toutes vos notifications ? Cette action est définitive.</p>
          <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
            Annuler
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              clear.mutate();
              setConfirmClear(false);
            }}
          >
            Effacer
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {list.isPending ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : list.isError && !list.items.length ? (
          <div className="p-4">
            <ErrorNotice message="Vérifiez votre connexion : les notifications déjà reçues restent consultables hors ligne." />
          </div>
        ) : !list.items.length ? (
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-line bg-container-low text-ink-faint">
              {tab === 'unread' ? <CheckCheck className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
            </span>
            <p className="font-semibold text-ink">{tab === 'unread' ? 'Vous êtes à jour' : 'Aucune notification'}</p>
            <p className="mt-1 max-w-64 text-body-sm text-ink-muted">
              Réponses à vos questions, mentions et alertes de sécurité arriveront ici en direct.
            </p>
          </div>
        ) : (
          <>
            {[...groups.entries()].map(([group, notifications]) => (
              <section key={group} aria-label={group}>
                <h3 className="sticky top-0 z-10 border-b border-line/60 bg-card/95 px-4 py-1.5 text-label-md font-semibold text-ink-faint backdrop-blur">
                  {group}
                </h3>
                <ul className="divide-y divide-line/60">
                  {notifications.map((notification) => (
                    <NotificationRow key={notification.id} notification={notification} onNavigate={onClose} />
                  ))}
                </ul>
              </section>
            ))}
            {list.hasNextPage ? (
              <div className="p-3">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage}>
                  Charger plus
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function NotificationRow({ notification, onNavigate }: { notification: Notification; onNavigate: () => void }) {
  const router = useRouter();
  const markRead = useMarkRead();
  const remove = useDeleteNotification();
  const [expanded, setExpanded] = useState(false);
  const unread = !notification.read_at;
  const style = KIND_STYLE[notification.kind] ?? KIND_STYLE.new_comment!;
  const Icon = style.icon;
  const href = notificationHref(notification);

  const open = () => {
    if (unread) markRead.mutate(notification);
    if (href) {
      onNavigate();
      router.push(href);
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <li className={cn('group relative transition-colors hover:bg-container-low', unread && 'bg-primary-soft/25')}>
      {unread ? <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden /> : null}
      <button
        type="button"
        onClick={open}
        aria-expanded={href ? undefined : expanded}
        className="flex w-full gap-3 py-3 pr-4 pl-4 text-left outline-none focus-visible:bg-container-low"
      >
        <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg', style.tone)}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-body-sm text-ink', unread ? 'font-semibold' : 'font-medium')}>
            {unread ? <span className="sr-only">Non lue : </span> : null}
            {notification.title}
          </span>
          {notification.body ? (
            <span className={cn('mt-0.5 block text-body-sm text-ink-muted', !expanded && 'line-clamp-2')}>{notification.body}</span>
          ) : null}
          <span className="mt-1.5 flex items-center gap-2 text-label-md text-ink-faint">
            <span>{style.label}</span>
            <span className="size-0.5 rounded-full bg-ink-faint" aria-hidden />
            <TimeAgo date={notification.created_at} />
            {href ? <span className="sr-only">, ouvrir</span> : null}
          </span>
        </span>
      </button>
      <div className="absolute right-3 bottom-2 flex items-center gap-0.5 rounded-lg sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {unread ? (
          <RowAction label="Marquer comme lue" onClick={() => markRead.mutate(notification)}>
            <Check className="size-3.5" aria-hidden />
          </RowAction>
        ) : null}
        <RowAction label="Supprimer" danger onClick={() => remove.mutate(notification)}>
          <Trash2 className="size-3.5" aria-hidden />
        </RowAction>
      </div>
    </li>
  );
}

function RowAction({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-md border border-line-strong bg-card text-ink-muted shadow-card transition-colors',
        danger ? 'hover:border-danger/40 hover:text-danger' : 'hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
