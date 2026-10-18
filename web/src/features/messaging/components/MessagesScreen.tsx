'use client';

import {
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  Copy,
  ImageIcon,
  ImagePlus,
  Languages,
  Loader2,
  MessageCircle,
  Mic,
  MoreVertical,
  Pencil,
  Reply,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
  Video,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useChatReplies } from '@/features/assistant';
import { translateText } from '@/features/translation';
import { errorMessage } from '@/shared/api';
import { useLang } from '@/shared/i18n';
import { cn } from '@/shared/lib';
import { absoluteMediaUrl, type MediaAsset, type MediaKind, MediaView, uploadMedia } from '@/shared/media';
import { RequireAuth, useSession } from '@/shared/session';
import { Avatar, Button, Dialog, Menu, MenuItem, MenuSeparator, Skeleton, TimeAgo, useToast } from '@/shared/ui';

import {
  canEdit,
  canRevoke,
  type Conversation,
  type Message,
  useClearConversation,
  useConversation,
  useDeleteMessages,
  useEditMessage,
  useInbox,
  useMarkConversationRead,
  useSendMessage,
  useThread,
} from '../api';

type Quoted = NonNullable<Message['reply_to']>;

/** Messages directs, façon WhatsApp : conversations à gauche, discussion à droite (une seule colonne sur mobile). */
export function MessagesScreen() {
  return (
    <RequireAuth>
      <Messages />
    </RequireAuth>
  );
}

function Messages() {
  const params = useSearchParams();
  const selected = params.get('c');
  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[28rem] overflow-hidden rounded-2xl border border-line bg-card shadow-card lg:h-[calc(100dvh-6.5rem)]">
      <aside className={cn('w-full shrink-0 flex-col border-line md:flex md:w-80 md:border-r', selected ? 'hidden' : 'flex')}>
        <Inbox selected={selected} />
      </aside>
      <section className={cn('min-w-0 flex-1 flex-col', selected ? 'flex' : 'hidden md:flex')}>
        {selected ? <Thread key={selected} id={selected} /> : <EmptyThread />}
      </section>
    </div>
  );
}

function Inbox({ selected }: { selected: string | null }) {
  const inbox = useInbox();
  return (
    <>
      <header className="flex h-14 shrink-0 items-center border-b border-line px-4">
        <h1 className="text-headline-md text-ink">Messages</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {inbox.isPending ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !inbox.items.length ? (
          <div className="px-6 py-12 text-center">
            <p className="font-semibold text-ink">Aucune conversation</p>
            <p className="mt-1 text-body-sm text-ink-muted">Ouvrez le profil d’un membre et touchez « Message » pour lui écrire.</p>
          </div>
        ) : (
          <ul>
            {inbox.items.map((conversation) => (
              <li key={conversation.id}>
                <ConversationRow conversation={conversation} active={conversation.id === selected} />
              </li>
            ))}
            {inbox.hasNextPage ? (
              <li className="p-3">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => inbox.fetchNextPage()} loading={inbox.isFetchingNextPage}>
                  Charger plus
                </Button>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </>
  );
}

function ConversationRow({ conversation, active }: { conversation: Conversation; active: boolean }) {
  const other = conversation.other;
  const name = other?.display_name || other?.username || 'Membre';
  const unread = conversation.unread > 0;
  const seen = Boolean(
    conversation.last_message_mine &&
      conversation.other_read_at &&
      conversation.last_message_at &&
      new Date(conversation.other_read_at) >= new Date(conversation.last_message_at),
  );
  return (
    <Link
      href={`/messages?c=${conversation.id}`}
      className={cn('flex items-center gap-3 px-4 py-3 transition-colors hover:bg-container-low', active && 'bg-container')}
    >
      <Avatar name={name} src={other?.avatar_url} size={48} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-body-md', unread ? 'font-bold text-ink' : 'font-medium text-ink')}>{name}</span>
          {conversation.last_message_at ? (
            <TimeAgo date={conversation.last_message_at} className={cn('shrink-0 text-label-sm', unread ? 'font-semibold text-primary' : 'text-ink-faint')} />
          ) : null}
        </span>
        <span className={cn('flex items-center gap-1 text-body-sm', unread ? 'font-semibold text-ink' : 'text-ink-muted')}>
          {conversation.last_message_mine ? (
            seen ? (
              <CheckCheck className="size-4 shrink-0 text-primary" aria-label="Vu" />
            ) : (
              <Check className="size-4 shrink-0 text-ink-faint" aria-label="Envoyé" />
            )
          ) : null}
          <span className="min-w-0 flex-1 truncate">{conversation.last_message_preview}</span>
          {unread ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-label-sm font-bold text-on-primary tabular-nums">
              {conversation.unread}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

function EmptyThread() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-container-low/40 p-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full border-2 border-ink">
        <MessageCircle className="size-8 text-ink" aria-hidden />
      </span>
      <p className="text-headline-md text-ink">Vos messages</p>
      <p className="max-w-xs text-body-sm text-ink-muted">Choisissez une conversation, ou écrivez à un membre depuis son profil.</p>
    </div>
  );
}

function Thread({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const conversation = useConversation(id);
  const thread = useThread(id);
  const markRead = useMarkConversationRead();
  const remove = useDeleteMessages(id);
  const clear = useClearConversation();
  const other = conversation.data?.other;
  const name = other?.display_name || other?.username || 'Membre';
  const newest = thread.items[0];

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [clearing, setClearing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const close = () => router.push('/messages');

  // Ouvrir la conversation, ou y recevoir un message, vaut lecture.
  const lastMarked = useRef<string | null>(null);
  useEffect(() => {
    if (!newest || newest.sender_id === user?.id || lastMarked.current === newest.id) return;
    lastMarked.current = newest.id;
    markRead.mutate(id);
  }, [id, markRead, newest, user?.id]);

  // Échap : quitte la sélection, la réponse ou la modification, puis ferme la discussion.
  const escape = useRef<() => void>(() => {});
  useEffect(() => {
    escape.current = () => {
      if (selecting) exitSelection();
      else if (editing) setEditing(null);
      else if (replyTo) setReplyTo(null);
      else close();
    };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open], [role="menu"]')) return;
      escape.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const otherReadAt = conversation.data?.other_read_at ? new Date(conversation.data.other_read_at).getTime() : 0;
  const chosen = thread.items.filter((message) => selected.has(message.id));

  function exitSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  function toggle(messageId: string, force?: boolean) {
    setSelecting(true);
    setSelected((current) => {
      const next = new Set(current);
      if (force ?? !next.has(messageId)) next.add(messageId);
      else next.delete(messageId);
      if (!next.size) setSelecting(false);
      return next;
    });
  }

  function startReply(message: Message) {
    setEditing(null);
    setReplyTo(message);
    exitSelection();
  }

  function startEdit(message: Message) {
    setReplyTo(null);
    setEditing(message);
    exitSelection();
  }

  async function copy(messages: Message[]) {
    const text = [...messages]
      .reverse()
      .map((message) => message.body)
      .filter(Boolean)
      .join('\n');
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast(messages.length > 1 ? 'Messages copiés.' : 'Message copié.');
    exitSelection();
  }

  function jumpTo(messageId: string) {
    const element = document.getElementById(`msg-${messageId}`);
    if (!element) {
      toast('Message plus ancien : chargez les messages précédents.', 'error');
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(messageId);
    window.setTimeout(() => setFlash(null), 1400);
  }

  const toDelete = thread.items.filter((message) => deleting?.includes(message.id));
  const revocable = toDelete.length > 0 && toDelete.every((message) => canRevoke(message, user?.id));

  function confirmDelete(forEveryone: boolean) {
    if (!deleting) return;
    remove.mutate(
      { ids: deleting, forEveryone },
      {
        onSuccess: ({ deleted }) => {
          toast(deleted > 1 ? `${deleted} messages supprimés.` : 'Message supprimé.');
          if (replyTo && deleting.includes(replyTo.id)) setReplyTo(null);
          if (editing && deleting.includes(editing.id)) setEditing(null);
          setDeleting(null);
          exitSelection();
        },
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );
  }

  const single = chosen.length === 1 ? chosen[0] : null;

  return (
    <>
      {selecting ? (
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line bg-primary-soft/40 px-2 sm:px-3">
          <IconAction label="Annuler la sélection" onClick={exitSelection}>
            <X />
          </IconAction>
          <p className="flex-1 pl-1 font-semibold text-ink tabular-nums">
            {chosen.length} sélectionné{chosen.length > 1 ? 's' : ''}
          </p>
          {single && !single.revoked ? (
            <IconAction label="Répondre" onClick={() => startReply(single)}>
              <Reply />
            </IconAction>
          ) : null}
          {single && canEdit(single, user?.id) ? (
            <IconAction label="Modifier" onClick={() => startEdit(single)}>
              <Pencil />
            </IconAction>
          ) : null}
          {chosen.some((message) => message.body) ? (
            <IconAction label="Copier" onClick={() => void copy(chosen)}>
              <Copy />
            </IconAction>
          ) : null}
          <IconAction label="Supprimer" disabled={!chosen.length} onClick={() => setDeleting(chosen.map((m) => m.id))} danger>
            <Trash2 />
          </IconAction>
        </header>
      ) : (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-2 sm:px-3">
          <IconAction label="Retour aux conversations" onClick={close} className="md:hidden">
            <ArrowLeft />
          </IconAction>
          {other ? (
            <Link href={`/u/${other.username}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90">
              <Avatar name={name} src={other.avatar_url} size={38} />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{name}</span>
                <span className="block truncate text-label-md text-ink-faint">@{other.username}</span>
              </span>
            </Link>
          ) : (
            <Skeleton className="h-8 flex-1" />
          )}
          <Menu
            trigger={(props) => (
              <IconAction label="Plus d’options" {...props}>
                <MoreVertical />
              </IconAction>
            )}
          >
            {other ? (
              <MenuItem href={`/u/${other.username}`}>
                <UserRound aria-hidden /> Voir le profil
              </MenuItem>
            ) : null}
            <MenuItem onSelect={() => setSelecting(true)}>
              <CheckSquare aria-hidden /> Sélectionner des messages
            </MenuItem>
            <MenuItem onSelect={close}>
              <X aria-hidden /> Fermer la discussion
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={() => setClearing(true)}>
              <Trash2 aria-hidden /> Supprimer la discussion
            </MenuItem>
          </Menu>
          <IconAction label="Fermer la discussion" onClick={close} className="hidden md:flex">
            <X />
          </IconAction>
        </header>
      )}

      {/* Colonne inversée : le défilement démarre en bas, sur le message le plus récent. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto bg-container-low/50 px-2 py-3 sm:px-4">
        {thread.items.map((message, index) => (
          <Bubble
            key={message.id}
            message={message}
            older={thread.items[index + 1]}
            newer={thread.items[index - 1]}
            mine={message.sender_id === user?.id}
            otherName={name}
            userId={user?.id}
            seen={otherReadAt >= new Date(message.created_at).getTime()}
            selecting={selecting}
            selected={selected.has(message.id)}
            flash={flash === message.id}
            onToggle={(force) => toggle(message.id, force)}
            onReply={() => startReply(message)}
            onEdit={() => startEdit(message)}
            onCopy={() => void copy([message])}
            onDelete={() => setDeleting([message.id])}
            onJump={jumpTo}
          />
        ))}
        {thread.hasNextPage ? (
          <Button variant="ghost" size="sm" className="mb-2 self-center" onClick={() => thread.fetchNextPage()} loading={thread.isFetchingNextPage}>
            Messages précédents
          </Button>
        ) : null}
        {!thread.isPending && !thread.items.length && other ? (
          <div className="m-auto flex flex-col items-center gap-2 text-center">
            <Avatar name={name} src={other.avatar_url} size={72} />
            <p className="font-semibold text-ink">{name}</p>
            <p className="text-body-sm text-ink-muted">Dites bonjour</p>
          </div>
        ) : null}
      </div>

      <Composer
        conversationId={id}
        otherName={name}
        userId={user?.id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
      />

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title={toDelete.length > 1 ? `Supprimer ${toDelete.length} messages ?` : 'Supprimer le message ?'}>
        <div className="flex flex-col gap-2">
          {revocable ? (
            <Button variant="outline" className="justify-center text-danger" loading={remove.isPending} onClick={() => confirmDelete(true)}>
              Supprimer pour tout le monde
            </Button>
          ) : null}
          <Button variant="outline" className="justify-center text-danger" loading={remove.isPending} onClick={() => confirmDelete(false)}>
            Supprimer pour moi
          </Button>
          <Button variant="ghost" className="justify-center" onClick={() => setDeleting(null)}>
            Annuler
          </Button>
        </div>
      </Dialog>

      <Dialog open={clearing} onClose={() => setClearing(false)} title="Supprimer la discussion ?">
        <p className="text-body-sm text-ink-muted">
          Tous les messages disparaissent de votre côté. {name} garde son historique. La discussion reviendra si vous recevez un nouveau message.
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setClearing(false)}>
            Annuler
          </Button>
          <Button
            className="bg-danger text-white hover:bg-danger/90"
            loading={clear.isPending}
            onClick={() =>
              clear.mutate(id, {
                onSuccess: () => {
                  setClearing(false);
                  toast('Discussion supprimée.');
                  close();
                },
                onError: (e) => toast(errorMessage(e), 'error'),
              })
            }
          >
            Supprimer
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function IconAction({
  label,
  children,
  className,
  danger,
  ...props
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  danger?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-container hover:text-ink disabled:opacity-40 [&_svg]:size-5',
        danger && 'hover:text-danger',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return 'Aujourd’hui';
  if (sameDay(date, yesterday)) return 'Hier';
  return date.toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

const MEDIA_LABEL: Record<string, { label: string; icon: typeof ImageIcon }> = {
  image: { label: 'Photo', icon: ImageIcon },
  video: { label: 'Vidéo', icon: Video },
  audio: { label: 'Message vocal', icon: Mic },
};

const LONG_PRESS_MS = 450;

function Bubble({
  message,
  older,
  newer,
  mine,
  otherName,
  userId,
  seen,
  selecting,
  selected,
  flash,
  onToggle,
  onReply,
  onEdit,
  onCopy,
  onDelete,
  onJump,
}: {
  message: Message;
  older?: Message;
  newer?: Message;
  mine: boolean;
  otherName: string;
  userId?: string;
  seen: boolean;
  selecting: boolean;
  selected: boolean;
  flash: boolean;
  onToggle: (force?: boolean) => void;
  onReply: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onJump: (id: string) => void;
}) {
  const at = new Date(message.created_at);
  const newDay = !older || !sameDay(at, new Date(older.created_at));
  // Bulles d'un même auteur à la suite : resserrées, seule la dernière garde sa « queue ».
  const grouped = Boolean(newer && newer.sender_id === message.sender_id && sameDay(at, new Date(newer.created_at)));
  const media = message.media as MediaAsset | null;
  const press = useRef<number | null>(null);
  const { locale } = useLang();
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const translate = async () => {
    if (translated) return setTranslated(null);
    setTranslating(true);
    try {
      setTranslated(await translateText(message.body, locale));
    } catch {
      setTranslated('Traduction indisponible pour le moment.');
    } finally {
      setTranslating(false);
    }
  };

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current);
    press.current = null;
  };

  return (
    <>
      <div
        id={`msg-${message.id}`}
        onClick={selecting ? () => onToggle() : undefined}
        onPointerDown={(event) => {
          if (event.pointerType !== 'touch' || selecting) return;
          press.current = window.setTimeout(() => {
            navigator.vibrate?.(20);
            onToggle(true);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerMove={cancelPress}
        onContextMenu={(event) => {
          if (selecting) return;
          event.preventDefault();
          onToggle(true);
        }}
        className={cn(
          'group -mx-2 flex items-center gap-2 px-2 transition-colors sm:-mx-4 sm:px-4',
          grouped ? 'py-px' : 'pt-px pb-1.5',
          selecting && 'cursor-pointer',
          selected && 'bg-primary/10',
          flash && 'bg-primary/15',
        )}
      >
        {selecting ? (
          <span
            aria-hidden
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
              selected ? 'border-primary bg-primary text-on-primary' : 'border-line-strong',
            )}
          >
            {selected ? <Check className="size-3" strokeWidth={3} /> : null}
          </span>
        ) : null}
        <div className={cn('flex min-w-0 flex-1 items-center gap-1', mine ? 'flex-row-reverse' : 'flex-row')}>
          <div
            className={cn(
              'relative max-w-[82%] min-w-0 rounded-2xl shadow-sm sm:max-w-[65%]',
              mine ? 'bg-primary text-on-primary' : 'bg-card text-ink',
              !grouped && (mine ? 'rounded-br-sm' : 'rounded-bl-sm'),
              media && !message.revoked ? 'p-1' : 'px-3 py-1.5',
            )}
          >
            {message.revoked ? (
              <p className={cn('flex items-center gap-1.5 pr-14 text-body-sm italic', mine ? 'text-on-primary/80' : 'text-ink-muted')}>
                <Ban className="size-3.5 shrink-0" aria-hidden />
                {mine ? 'Vous avez supprimé ce message' : 'Ce message a été supprimé'}
              </p>
            ) : (
              <>
                {message.reply_to ? (
                  <Quote
                    quote={message.reply_to}
                    author={message.reply_to.sender_id === userId ? 'Vous' : otherName}
                    onPrimary={mine}
                    onClick={selecting ? undefined : () => onJump(message.reply_to!.id)}
                    className={media ? 'mb-1' : '-mx-1.5 mt-0.5 mb-1'}
                  />
                ) : null}
                {media ? <ChatMedia media={media} mine={mine} /> : null}
                {message.body ? (
                  <p className={cn('text-body-md break-words whitespace-pre-wrap', media && 'px-2 pt-1', 'pr-1')}>
                    {message.body}
                    {/* Réserve la place de l'heure sur la dernière ligne, comme WhatsApp. */}
                    <span aria-hidden className={cn('inline-block', message.edited_at ? 'w-24' : 'w-14')} />
                  </p>
                ) : null}
                {translating || translated ? (
                  <p
                    className={cn(
                      'mt-1 mb-4 border-l-2 pl-2 text-body-sm italic',
                      mine ? 'border-on-primary/50 text-on-primary/85' : 'border-primary/50 text-ink-muted',
                      media && 'mx-2',
                    )}
                  >
                    {translating ? 'Traduction…' : translated}
                  </p>
                ) : null}
              </>
            )}
            <span
              className={cn(
                'pointer-events-none absolute right-2 bottom-1 flex items-center gap-1 text-[0.68rem] leading-none tabular-nums',
                mine ? 'text-on-primary/75' : 'text-ink-faint',
                media && !message.body && !message.revoked && 'rounded-full bg-black/45 px-1.5 py-1 text-white',
              )}
            >
              {message.edited_at && !message.revoked ? <span>modifié</span> : null}
              {at.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
              {mine && !message.revoked ? (
                seen ? (
                  <CheckCheck className="size-3.5" aria-label="Vu" />
                ) : (
                  <Check className="size-3.5" aria-label="Envoyé" />
                )
              ) : null}
            </span>
            {!selecting ? (
              <div className={cn('absolute top-1', mine ? 'right-1' : 'right-1')}>
                <Menu
                  align={mine ? 'end' : 'start'}
                  trigger={(props) => (
                    <button
                      type="button"
                      aria-label="Actions du message"
                      {...props}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100',
                        mine ? 'bg-primary text-on-primary' : 'bg-card text-ink-muted',
                      )}
                    >
                      <ChevronDown className="size-4" aria-hidden />
                    </button>
                  )}
                >
                  {!message.revoked ? (
                    <MenuItem onSelect={onReply}>
                      <Reply aria-hidden /> Répondre
                    </MenuItem>
                  ) : null}
                  {message.body ? (
                    <MenuItem onSelect={onCopy}>
                      <Copy aria-hidden /> Copier
                    </MenuItem>
                  ) : null}
                  {message.body && !message.revoked ? (
                    <MenuItem onSelect={() => void translate()}>
                      <Languages aria-hidden /> {translated ? 'Voir l’original' : 'Traduire'}
                    </MenuItem>
                  ) : null}
                  {canEdit(message, userId) ? (
                    <MenuItem onSelect={onEdit}>
                      <Pencil aria-hidden /> Modifier
                    </MenuItem>
                  ) : null}
                  <MenuItem onSelect={() => onToggle(true)}>
                    <CheckSquare aria-hidden /> Sélectionner
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem danger onSelect={onDelete}>
                    <Trash2 aria-hidden /> Supprimer
                  </MenuItem>
                </Menu>
              </div>
            ) : null}
          </div>
          {!selecting && !message.revoked ? (
            <button
              type="button"
              onClick={onReply}
              aria-label="Répondre"
              title="Répondre"
              className="hidden size-8 shrink-0 items-center justify-center rounded-full text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-container hover:text-ink sm:flex"
            >
              <Reply className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      {message.risk_note ? (
        <p role="alert" className="mx-2 mb-2 flex max-w-[82%] items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-body-sm text-on-danger-soft sm:max-w-[65%]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>Arnaque probable.</strong> {message.risk_note} Ne payez rien et ne partagez aucun code reçu par SMS.
          </span>
        </p>
      ) : null}
      {newDay ? (
        <p className="sticky top-0 z-10 self-center py-2">
          <span className="rounded-lg bg-card px-3 py-1 text-label-sm font-medium text-ink-muted shadow-sm first-letter:uppercase">{dayLabel(at)}</span>
        </p>
      ) : null}
    </>
  );
}

/** Message cité : au-dessus d'une réponse, ou dans la barre de saisie pendant qu'on répond. */
function Quote({
  quote,
  author,
  onPrimary,
  onClick,
  className,
}: {
  quote: Quoted | Message;
  author: string;
  onPrimary?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const media = quote.media as MediaAsset | null;
  const kind = media ? MEDIA_LABEL[media.kind] : null;
  const thumb = media?.kind === 'image' ? (absoluteMediaUrl(media.urls.small) ?? absoluteMediaUrl(media.original_url)) : null;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick: (event: React.MouseEvent) => (event.stopPropagation(), onClick()) } : {})}
      className={cn(
        'flex w-full min-w-0 items-stretch overflow-hidden rounded-lg text-left',
        onPrimary ? 'bg-black/15' : 'bg-container',
        onClick && 'transition-opacity hover:opacity-85',
        className,
      )}
    >
      <span className={cn('w-1 shrink-0', onPrimary ? 'bg-on-primary/80' : 'bg-primary')} aria-hidden />
      <span className="min-w-0 flex-1 px-2.5 py-1.5">
        <span className={cn('block truncate text-label-md font-semibold', onPrimary ? 'text-on-primary' : 'text-primary')}>{author}</span>
        <span className={cn('flex items-center gap-1 text-body-sm', onPrimary ? 'text-on-primary/85' : 'text-ink-muted')}>
          {quote.revoked ? (
            <>
              <Ban className="size-3.5 shrink-0" aria-hidden /> <span className="italic">Message supprimé</span>
            </>
          ) : (
            <>
              {kind ? <kind.icon className="size-3.5 shrink-0" aria-hidden /> : null}
              <span className="line-clamp-2 break-words">{quote.body || kind?.label || 'Message'}</span>
            </>
          )}
        </span>
      </span>
      {thumb && !quote.revoked ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniature du CDN
        <img src={thumb} alt="" className="size-14 shrink-0 object-cover" />
      ) : null}
    </Tag>
  );
}

/** Photo (agrandie au clic), vidéo lue sur place ou message vocal, visibles dès l'envoi. */
function ChatMedia({ media, mine }: { media: MediaAsset; mine: boolean }) {
  const original = absoluteMediaUrl(media.original_url);
  if (media.kind === 'audio') {
    return (
      <div className="flex items-center gap-2 px-2 pt-1.5 pb-5">
        <Mic className={cn('size-4 shrink-0', mine ? 'text-on-primary' : 'text-ink-muted')} aria-hidden />
        <audio controls preload="metadata" src={absoluteMediaUrl(media.urls.opus) ?? original} className="h-9 w-60 max-w-full" />
      </div>
    );
  }
  if (media.kind === 'video') {
    if (media.status === 'ready' && media.urls.hls) return <MediaView media={media} className="w-72 max-w-full rounded-xl" />;
    return <video controls preload="metadata" src={original} className="max-h-96 w-72 max-w-full rounded-xl bg-black" />;
  }
  const src = absoluteMediaUrl(media.urls.large) ?? original;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="block overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element -- image du CDN, déjà recompressée */}
      <img src={absoluteMediaUrl(media.urls.small) ?? src} alt="Photo" className="max-h-80 w-auto max-w-full object-cover sm:max-w-72" />
    </a>
  );
}

const MAX_VOICE_SECONDS = 120;

/** Saisie : pièce jointe, texte, vocal ; barre « Réponse à … » ou « Modifier le message » au-dessus. */
function Composer({
  conversationId,
  otherName,
  userId,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
}: {
  conversationId: string;
  otherName: string;
  userId?: string;
  replyTo: Message | null;
  onCancelReply: () => void;
  editing: Message | null;
  onCancelEdit: () => void;
}) {
  const send = useSendMessage(conversationId);
  const edit = useEditMessage(conversationId);
  const [body, setBody] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceRecorder();
  const suggestions = useChatReplies();
  const text = body.trim();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modifier : le texte du message remplace la saisie, qui est rendue à la fin.
  if ((editing?.id ?? null) !== editingId) {
    setEditingId(editing?.id ?? null);
    if (editing) {
      if (!editingId) setDraft(body);
      setBody(editing.body);
    } else {
      setBody(draft);
      setDraft('');
    }
  }

  useEffect(() => {
    if (!replyTo && !editing) return;
    const field = textarea.current;
    field?.focus();
    field?.setSelectionRange(field.value.length, field.value.length);
  }, [replyTo, editing]);

  // Hauteur du champ ajustée au texte (5 lignes au plus).
  useEffect(() => {
    const field = textarea.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 128)}px`;
  }, [body]);

  function submit() {
    if (editing) {
      if ((!text && !editing.media) || edit.isPending) return;
      if (text === editing.body) return onCancelEdit();
      edit.mutate({ id: editing.id, body: text }, { onSuccess: onCancelEdit });
      return;
    }
    if (!text || send.isPending) return;
    send.mutate(
      { body: text, reply_to_id: replyTo?.id },
      {
        onSuccess: () => {
          setBody('');
          onCancelReply();
        },
      },
    );
  }

  async function sendMedia(file: Blob, kind: MediaKind, label: string, name = 'fichier') {
    setError(null);
    setUploading(label);
    try {
      // « audio/webm;codecs=opus » → « audio/webm » : le serveur valide le type sans paramètres.
      const type = file.type.split(';')[0] || 'application/octet-stream';
      const named = file instanceof File && file.type === type ? file : new File([file], file instanceof File ? file.name : name, { type });
      const asset = await uploadMedia(named, kind);
      await send.mutateAsync({ media_id: asset.id, body: text, reply_to_id: replyTo?.id });
      setBody('');
      onCancelReply();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(null);
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    const kind: MediaKind | null = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
    if (!kind) {
      setError('Choisissez une photo ou une vidéo.');
      return;
    }
    await sendMedia(file, kind, kind === 'image' ? 'Envoi de la photo…' : 'Envoi de la vidéo…');
  }

  async function finishVoice() {
    const blob = await voice.stop();
    if (blob) await sendMedia(blob, 'audio', 'Envoi du vocal…', 'vocal.webm');
  }

  const failure = error ?? voice.error ?? (send.isError ? errorMessage(send.error) : edit.isError ? errorMessage(edit.error) : null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="shrink-0 border-t border-line bg-card px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3"
    >
      {failure ? <p className="mb-2 px-1 text-body-sm text-danger">{failure}</p> : null}
      {uploading ? (
        <p className="mb-2 flex items-center gap-2 px-1 text-body-sm text-ink-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {uploading}
        </p>
      ) : null}

      {suggestions.data?.replies.length && !editing && !text ? (
        <div className="scrollbar-none mb-2 flex gap-2 overflow-x-auto px-1">
          {suggestions.data.replies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => {
                setBody(reply);
                suggestions.reset();
                textarea.current?.focus();
              }}
              className="h-8 shrink-0 rounded-full border border-primary/30 bg-primary-soft/50 px-3 text-body-sm text-ink hover:bg-primary-soft"
            >
              {reply}
            </button>
          ))}
        </div>
      ) : suggestions.isError ? (
        <p className="mb-2 px-1 text-body-sm text-danger">{errorMessage(suggestions.error)}</p>
      ) : null}

      {replyTo || editing ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-container-low p-1.5">
          {editing ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1">
              <Pencil className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">
                <span className="block text-label-md font-semibold text-primary">Modifier le message</span>
                <span className="block truncate text-body-sm text-ink-muted">{editing.body || 'Légende du média'}</span>
              </span>
            </div>
          ) : replyTo ? (
            <Quote quote={replyTo} author={replyTo.sender_id === userId ? 'Vous' : otherName} className="flex-1" />
          ) : null}
          <IconAction label={editing ? 'Annuler la modification' : 'Annuler la réponse'} onClick={editing ? onCancelEdit : onCancelReply} className="size-8">
            <X />
          </IconAction>
        </div>
      ) : null}

      {voice.recording ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void voice.cancel()}
            aria-label="Annuler le vocal"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-container hover:text-danger"
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
          <div className="flex h-11 flex-1 items-center gap-3 rounded-full bg-danger-soft px-4 text-on-danger-soft">
            <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden />
            <span className="text-body-md font-semibold tabular-nums">
              {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
            </span>
            <span className="text-body-sm">Enregistrement…</span>
          </div>
          <button
            type="button"
            onClick={() => void finishVoice()}
            aria-label="Envoyer le vocal"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
          >
            <Send className="size-5" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          {!editing ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={Boolean(uploading)}
              aria-label="Envoyer une photo ou une vidéo"
              title={text ? 'Le texte sera envoyé comme légende' : 'Photo ou vidéo'}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-container hover:text-ink disabled:opacity-40"
            >
              <ImagePlus className="size-5" aria-hidden />
            </button>
          ) : null}
          {!editing ? (
            <button
              type="button"
              onClick={() => suggestions.mutate(conversationId)}
              disabled={suggestions.isPending}
              aria-label="Réponses suggérées par l’IA"
              title="Réponses suggérées par l’IA"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-container hover:text-primary disabled:opacity-60"
            >
              {suggestions.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
            </button>
          ) : null}
          <div className="flex min-h-11 flex-1 items-end rounded-3xl bg-container px-4">
            <textarea
              ref={textarea}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder={editing ? 'Modifier le message…' : 'Écrire un message…'}
              aria-label="Votre message"
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-body-md text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
          {editing ? (
            <button
              type="submit"
              disabled={edit.isPending || (!text && !editing.media)}
              aria-label="Enregistrer la modification"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-opacity disabled:opacity-40"
            >
              {edit.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Check className="size-5" aria-hidden />}
            </button>
          ) : text ? (
            <button
              type="submit"
              disabled={send.isPending || Boolean(uploading)}
              aria-label="Envoyer"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-opacity disabled:opacity-40"
            >
              <Send className="size-5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void voice.start()}
              disabled={Boolean(uploading)}
              aria-label="Enregistrer un message vocal"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-opacity disabled:opacity-40"
            >
              <Mic className="size-5" aria-hidden />
            </button>
          )}
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        hidden
        onChange={(event) => void pickFile(event.target.files?.[0]).finally(() => (event.target.value = ''))}
      />
    </form>
  );
}

/** Message vocal : Opus mono à faible débit, 2 minutes au plus. */
function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const settle = useRef<((blob: Blob | null) => void) | null>(null);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value + 1 >= MAX_VOICE_SECONDS) recorder.current?.stop();
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError("L'enregistrement audio n'est pas disponible sur ce navigateur.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const rec = new MediaRecorder(stream, { mimeType: mimeType || undefined, audioBitsPerSecond: 24_000 });
      chunks.current = [];
      rec.ondataavailable = (event) => chunks.current.push(event.data);
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        settle.current?.(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }));
        settle.current = null;
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
    } catch {
      setError('Accès au micro refusé.');
    }
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!recorder.current || recorder.current.state === 'inactive') return resolve(null);
      settle.current = resolve;
      recorder.current.stop();
    });
  }

  async function cancel() {
    await stop();
    chunks.current = [];
  }

  return { recording, seconds, error, start, stop, cancel };
}
