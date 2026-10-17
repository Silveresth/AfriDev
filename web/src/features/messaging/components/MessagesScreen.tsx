'use client';

import { ArrowLeft, ImagePlus, Loader2, MessageCircle, Mic, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { absoluteMediaUrl, type MediaAsset, type MediaKind, MediaView, uploadMedia } from '@/shared/media';
import { RequireAuth, useSession } from '@/shared/session';
import { Avatar, Button, Skeleton, TimeAgo } from '@/shared/ui';

import {
  type Conversation,
  type Message,
  useConversation,
  useInbox,
  useMarkConversationRead,
  useSendMessage,
  useThread,
} from '../api';

/** Messages directs, façon TikTok : conversations à gauche, fil de discussion à droite. */
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
        {selected ? <Thread id={selected} /> : <EmptyThread />}
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
  return (
    <Link
      href={`/messages?c=${conversation.id}`}
      className={cn('flex items-center gap-3 px-4 py-3 transition-colors hover:bg-container-low', active && 'bg-container')}
    >
      <Avatar name={name} src={other?.avatar_url} size={48} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-body-md', unread ? 'font-bold text-ink' : 'font-medium text-ink')}>{name}</span>
        <span className={cn('flex items-center gap-1 text-body-sm', unread ? 'font-semibold text-ink' : 'text-ink-muted')}>
          <span className="truncate">
            {conversation.last_message_mine ? 'Vous : ' : ''}
            {conversation.last_message_preview}
          </span>
          {conversation.last_message_at ? (
            <>
              <span aria-hidden>·</span>
              <TimeAgo date={conversation.last_message_at} className="shrink-0 text-ink-faint" />
            </>
          ) : null}
        </span>
      </span>
      {unread ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-label-sm font-bold text-on-primary tabular-nums">
          {conversation.unread}
        </span>
      ) : null}
    </Link>
  );
}

function EmptyThread() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
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
  const { user } = useSession();
  const conversation = useConversation(id);
  const thread = useThread(id);
  const markRead = useMarkConversationRead();
  const other = conversation.data?.other;
  const name = other?.display_name || other?.username || 'Membre';
  const newest = thread.items[0];

  // Ouvrir la conversation, ou y recevoir un message, vaut lecture.
  const lastMarked = useRef<string | null>(null);
  useEffect(() => {
    if (!newest || newest.sender_id === user?.id || lastMarked.current === newest.id) return;
    lastMarked.current = newest.id;
    markRead.mutate(id);
  }, [id, markRead, newest, user?.id]);

  // Dernier de mes messages vu par l'autre : « Vu » sous la bulle.
  const otherReadAt = conversation.data?.other_read_at ? new Date(conversation.data.other_read_at).getTime() : 0;
  const lastMine = thread.items.find((message) => message.sender_id === user?.id);
  const seen = Boolean(lastMine && otherReadAt >= new Date(lastMine.created_at).getTime());

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3 sm:px-4">
        <button
          type="button"
          onClick={() => router.push('/messages')}
          aria-label="Retour aux conversations"
          className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-container md:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        {other ? (
          <Link href={`/u/${other.username}`} className="flex min-w-0 items-center gap-3 hover:opacity-90">
            <Avatar name={name} src={other.avatar_url} size={36} />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{name}</span>
              <span className="block truncate text-label-md text-ink-faint">@{other.username}</span>
            </span>
          </Link>
        ) : (
          <Skeleton className="h-8 w-40" />
        )}
      </header>

      {/* Colonne inversée : le défilement démarre en bas, sur le message le plus récent. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-1.5 overflow-y-auto px-3 py-4 sm:px-5">
        {seen ? <p className="self-end pr-1 text-label-sm text-ink-faint">Vu</p> : null}
        {thread.items.map((message, index) => (
          <Bubble key={message.id} message={message} mine={message.sender_id === user?.id} older={thread.items[index + 1]} />
        ))}
        {thread.hasNextPage ? (
          <Button variant="ghost" size="sm" className="self-center" onClick={() => thread.fetchNextPage()} loading={thread.isFetchingNextPage}>
            Messages précédents
          </Button>
        ) : null}
        {!thread.isPending && !thread.items.length && other ? (
          <div className="m-auto flex flex-col items-center gap-2 text-center">
            <Avatar name={name} src={other.avatar_url} size={72} />
            <p className="font-semibold text-ink">{name}</p>
            <p className="text-body-sm text-ink-muted">Dites bonjour 👋</p>
          </div>
        ) : null}
      </div>

      <Composer conversationId={id} />
    </>
  );
}

function Bubble({ message, mine, older }: { message: Message; mine: boolean; older?: Message }) {
  const at = new Date(message.created_at);
  // Séparateur horaire quand plus d'une heure sépare deux messages.
  const gap = !older || at.getTime() - new Date(older.created_at).getTime() > 3600 * 1000;
  const media = message.media as MediaAsset | null;
  return (
    <>
      <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
        {media ? <ChatMedia media={media} mine={mine} /> : null}
        {message.body ? (
          <p
            className={cn(
              'max-w-[75%] rounded-[1.25rem] px-3.5 py-2 text-body-md break-words whitespace-pre-wrap',
              mine ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md bg-container text-ink',
            )}
          >
            {message.body}
          </p>
        ) : null}
      </div>
      {gap ? (
        <p className="py-2 text-center text-label-sm text-ink-faint">
          {at.toLocaleString('fr', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      ) : null}
    </>
  );
}

/** Photo (agrandie au clic), vidéo lue sur place ou message vocal, visibles dès l'envoi. */
function ChatMedia({ media, mine }: { media: MediaAsset; mine: boolean }) {
  const original = absoluteMediaUrl(media.original_url);
  if (media.kind === 'audio') {
    return (
      <div className={cn('flex items-center gap-2 rounded-[1.25rem] px-3 py-2', mine ? 'bg-primary' : 'bg-container')}>
        <Mic className={cn('size-4 shrink-0', mine ? 'text-on-primary' : 'text-ink-muted')} aria-hidden />
        <audio controls preload="metadata" src={absoluteMediaUrl(media.urls.opus) ?? original} className="h-9 w-60 max-w-full" />
      </div>
    );
  }
  if (media.kind === 'video') {
    if (media.status === 'ready' && media.urls.hls) return <MediaView media={media} className="w-72 max-w-[75%] rounded-2xl" />;
    return <video controls preload="metadata" src={original} className="max-h-96 w-72 max-w-[75%] rounded-2xl bg-black" />;
  }
  const src = absoluteMediaUrl(media.urls.large) ?? original;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block max-w-[75%] overflow-hidden rounded-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element -- image du CDN, déjà recompressée */}
      <img src={absoluteMediaUrl(media.urls.small) ?? src} alt="Photo" className="max-h-80 w-auto max-w-64 object-cover" />
    </a>
  );
}

const MAX_VOICE_SECONDS = 120;

/** Saisie façon TikTok : pièce jointe, texte, vocal (maintenu en enregistrement) et envoi. */
function Composer({ conversationId }: { conversationId: string }) {
  const send = useSendMessage(conversationId);
  const [body, setBody] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();
  const text = body.trim();

  function submit() {
    if (!text || send.isPending) return;
    send.mutate({ body: text }, { onSuccess: () => setBody('') });
  }

  async function sendMedia(file: Blob, kind: MediaKind, label: string, name = 'fichier') {
    setError(null);
    setUploading(label);
    try {
      // « audio/webm;codecs=opus » → « audio/webm » : le serveur valide le type sans paramètres.
      const type = file.type.split(';')[0] || 'application/octet-stream';
      const named = file instanceof File && file.type === type ? file : new File([file], file instanceof File ? file.name : name, { type });
      const asset = await uploadMedia(named, kind);
      await send.mutateAsync({ media_id: asset.id });
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

  const failure = error ?? voice.error ?? (send.isError ? errorMessage(send.error) : null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="shrink-0 border-t border-line p-3"
    >
      {failure ? <p className="mb-2 text-body-sm text-danger">{failure}</p> : null}
      {uploading ? (
        <p className="mb-2 flex items-center gap-2 text-body-sm text-ink-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {uploading}
        </p>
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
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={Boolean(uploading)}
            aria-label="Envoyer une photo ou une vidéo"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-container hover:text-ink disabled:opacity-40"
          >
            <ImagePlus className="size-5" aria-hidden />
          </button>
          <div className="flex min-h-11 flex-1 items-end rounded-3xl bg-container px-4">
            <textarea
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
              placeholder="Envoyer un message…"
              aria-label="Votre message"
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-body-md text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
          {text ? (
            <button
              type="submit"
              disabled={send.isPending}
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
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-container hover:text-ink disabled:opacity-40"
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
