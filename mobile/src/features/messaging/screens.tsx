import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Ban,
  Check,
  CheckCheck,
  CheckSquare,
  Copy,
  ImageIcon,
  ImagePlus,
  Languages,
  type LucideIcon,
  MessageCircle,
  Mic,
  MoreVertical,
  Pencil,
  Reply,
  SendHorizontal,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
  Video,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  PanResponder,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatReplies } from '@/features/assistant';
import { translateText } from '@/features/translation';
import { absoluteUrl, errorMessage, type Schemas } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { timeAgo } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Avatar, BackArrow, EmptyState, ErrorState, Header, IconButton, ListFooter, Loading, Sheet, Text, useToast } from '@/shared/ui';

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
  useMarkRead,
  useSendMessage,
  useThread,
} from './api';
import { ChatMedia, pickAndUploadMedia, useVoiceRecorder } from './media';

type MediaAsset = Schemas['MediaOutput'];
type Quoted = NonNullable<Message['reply_to']>;
type T = ReturnType<typeof useT>['t'];

/** Boîte de réception : une ligne par conversation, la plus récente en haut. */
export function InboxScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const inbox = useInbox();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title={t('dm.title')} back />
      {inbox.isPending ? (
        <Loading />
      ) : inbox.isError && !inbox.items.length ? (
        <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
      ) : (
        <FlatList
          data={inbox.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationRow conversation={item} />}
          onEndReached={inbox.loadMore}
          refreshControl={
            <RefreshControl refreshing={inbox.isRefetching && !inbox.isFetchingNextPage} onRefresh={() => void inbox.refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={<EmptyState icon={MessageCircle} title={t('dm.empty')} body={t('dm.empty_body')} />}
          ListFooterComponent={<ListFooter loading={inbox.isFetchingNextPage} />}
          contentContainerStyle={styles.grow}
        />
      )}
    </View>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const { colors } = useTheme();
  const { t } = useT();
  const other = conversation.other;
  const name = other?.display_name || other?.username || t('member');
  const unread = conversation.unread > 0;
  const seen = Boolean(
    conversation.last_message_mine &&
      conversation.other_read_at &&
      conversation.last_message_at &&
      new Date(conversation.other_read_at) >= new Date(conversation.last_message_at),
  );
  const Tick = seen ? CheckCheck : Check;
  return (
    <Pressable
      onPress={() => router.push(`/messages/${conversation.id}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressed }]}
    >
      <Avatar name={name} src={other?.avatar_url} size={52} />
      <View style={styles.flex}>
        <View style={styles.rowTop}>
          <Text variant={unread ? 'bodyStrong' : 'body'} numberOfLines={1} style={styles.flex}>
            {name}
          </Text>
          {conversation.last_message_at ? (
            <Text variant="caption" style={{ color: unread ? colors.primary : colors.inkFaint }}>
              {timeAgo(conversation.last_message_at)}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowTop}>
          {conversation.last_message_mine ? <Tick size={15} color={seen ? colors.primary : colors.inkFaint} /> : null}
          <Text variant="small" tone={unread ? 'ink' : 'muted'} numberOfLines={1} style={[styles.flex, unread ? styles.strong : null]}>
            {conversation.last_message_preview}
          </Text>
          {unread ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text variant="caption" style={{ color: colors.onPrimary, fontWeight: '700' }}>
                {conversation.unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Discussion façon WhatsApp : appui long pour sélectionner, glisser vers la droite pour répondre. */
export function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const conversation = useConversation(id);
  const thread = useThread(id);
  const markRead = useMarkRead();
  const remove = useDeleteMessages(id);
  const clear = useClearConversation();
  const other = conversation.data?.other;
  const name = other?.display_name || other?.username || t('member');
  const newest = thread.items[0];
  const list = useRef<FlatList<Message>>(null);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [options, setOptions] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const lastMarked = useRef<string | null>(null);
  useEffect(() => {
    if (!newest || newest.sender_id === user?.id || lastMarked.current === newest.id) return;
    lastMarked.current = newest.id;
    markRead.mutate(id);
  }, [id, markRead, newest, user?.id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/messages'));

  // Bouton retour Android : quitte la sélection, la réponse ou la modification avant l'écran.
  const back = useRef<() => boolean>(() => false);
  useEffect(() => {
    back.current = () => {
      if (selecting) exitSelection();
      else if (editing) setEditing(null);
      else if (replyTo) setReplyTo(null);
      else return false;
      return true;
    };
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => back.current());
    return () => subscription.remove();
  }, []);

  const otherReadAt = conversation.data?.other_read_at ? new Date(conversation.data.other_read_at).getTime() : 0;
  const chosen = thread.items.filter((message) => selected.has(message.id));
  const single = chosen.length === 1 ? chosen[0] : null;

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

  async function translate(message: Message) {
    exitSelection();
    toast(t('dm.translating'));
    try {
      Alert.alert(t('feed.translate'), await translateText(message.body, locale));
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  }

  async function copy(messages: Message[]) {
    const text = [...messages]
      .reverse()
      .map((message) => message.body)
      .filter(Boolean)
      .join('\n');
    if (!text) return;
    await Clipboard.setStringAsync(text);
    toast(t('dm.copied'));
    exitSelection();
  }

  function jumpTo(messageId: string) {
    const index = thread.items.findIndex((message) => message.id === messageId);
    if (index < 0) {
      toast(t('dm.older'));
      return;
    }
    list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    setFlash(messageId);
    setTimeout(() => setFlash(null), 1400);
  }

  function askDelete(messages: Message[]) {
    if (!messages.length) return;
    const ids = messages.map((message) => message.id);
    const run = (forEveryone: boolean) =>
      remove.mutate(
        { ids, forEveryone },
        {
          onSuccess: () => {
            haptic.success();
            toast(t('dm.deleted'));
            if (replyTo && ids.includes(replyTo.id)) setReplyTo(null);
            if (editing && ids.includes(editing.id)) setEditing(null);
            exitSelection();
          },
          onError: (error) => toast(errorMessage(error), 'error'),
        },
      );
    const revocable = messages.every((message) => canRevoke(message, user?.id));
    Alert.alert(t('dm.delete_title', { count: messages.length }), undefined, [
      ...(revocable ? [{ text: t('dm.delete_everyone'), style: 'destructive' as const, onPress: () => run(true) }] : []),
      { text: t('dm.delete_me'), style: 'destructive', onPress: () => run(false) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  function askClear() {
    setOptions(false);
    Alert.alert(t('dm.clear'), t('dm.clear_body', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('dm.delete'),
        style: 'destructive',
        onPress: () =>
          clear.mutate(id, {
            onSuccess: () => {
              toast(t('dm.cleared'));
              close();
            },
            onError: (error) => toast(errorMessage(error), 'error'),
          }),
      },
    ]);
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.surface }]}>
      {selecting ? (
        <View style={[styles.topBar, { paddingTop: insets.top, backgroundColor: colors.primarySoft, borderBottomColor: colors.line }]}>
          <View style={styles.topInner}>
            <IconButton icon={X} label={t('dm.cancel_selection')} onPress={exitSelection} />
            <Text variant="headline" style={styles.flex}>
              {t('dm.selected', { count: chosen.length })}
            </Text>
            {single && !single.revoked ? <IconButton icon={Reply} label={t('dm.reply')} onPress={() => startReply(single)} /> : null}
            {single && canEdit(single, user?.id) ? <IconButton icon={Pencil} label={t('dm.edit')} onPress={() => startEdit(single)} /> : null}
            {single?.body && !single.revoked ? <IconButton icon={Languages} label={t('feed.translate')} onPress={() => void translate(single)} /> : null}
            {chosen.some((message) => message.body) ? <IconButton icon={Copy} label={t('dm.copy')} onPress={() => void copy(chosen)} /> : null}
            <IconButton icon={Trash2} label={t('dm.delete')} color={colors.danger} onPress={() => askDelete(chosen)} />
          </View>
        </View>
      ) : (
        <View style={[styles.topBar, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.line }]}>
          <View style={styles.topInner}>
            <IconButton icon={BackArrow} label={t('dm.close')} onPress={close} />
            <Pressable
              onPress={() => other && router.push(`/u/${other.username}`)}
              accessibilityRole="button"
              accessibilityLabel={t('dm.view_profile')}
              style={styles.peer}
            >
              <Avatar name={name} src={other?.avatar_url} size={38} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {name}
                </Text>
                {other ? (
                  <Text variant="caption" tone="faint" numberOfLines={1}>
                    @{other.username}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            <IconButton icon={MoreVertical} label={t('dm.options')} onPress={() => setOptions(true)} />
          </View>
        </View>
      )}

      {thread.isPending ? (
        <Loading />
      ) : !thread.items.length ? (
        // Hors de la liste inversée : affiché à l'endroit, au centre (premier contact).
        <Pressable style={styles.hello} onPress={() => other && router.push(`/u/${other.username}`)} disabled={!other}>
          {other ? (
            <>
              <Avatar name={name} src={other.avatar_url} size={88} />
              <Text variant="headline">{name}</Text>
              <Text variant="small" tone="faint">
                @{other.username}
              </Text>
              <Text tone="muted" style={styles.sayHi}>
                {t('dm.say_hi')}
              </Text>
            </>
          ) : null}
        </Pressable>
      ) : (
        <FlatList
          ref={list}
          inverted
          data={thread.items}
          keyExtractor={(item) => item.id}
          extraData={[selecting, selected, flash, otherReadAt]}
          renderItem={({ item, index }) => (
            <Bubble
              message={item}
              older={thread.items[index + 1]}
              newer={thread.items[index - 1]}
              mine={item.sender_id === user?.id}
              userId={user?.id}
              otherName={name}
              seen={otherReadAt >= new Date(item.created_at).getTime()}
              selecting={selecting}
              selected={selected.has(item.id)}
              flash={flash === item.id}
              onToggle={(force) => toggle(item.id, force)}
              onReply={() => startReply(item)}
              onJump={jumpTo}
            />
          )}
          onEndReached={thread.loadMore}
          onScrollToIndexFailed={({ index }) => setTimeout(() => list.current?.scrollToIndex({ index, viewPosition: 0.5 }), 250)}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={<ListFooter loading={thread.isFetchingNextPage} />}
        />
      )}
      <Composer
        conversationId={id}
        otherName={name}
        userId={user?.id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
      />

      <Sheet visible={options} onClose={() => setOptions(false)} title={name}>
        {other ? (
          <SheetRow
            icon={UserRound}
            label={t('dm.view_profile')}
            onPress={() => {
              setOptions(false);
              router.push(`/u/${other.username}`);
            }}
          />
        ) : null}
        <SheetRow
          icon={CheckSquare}
          label={t('dm.select_messages')}
          onPress={() => {
            setOptions(false);
            setSelecting(true);
          }}
        />
        <SheetRow
          icon={X}
          label={t('dm.close')}
          onPress={() => {
            setOptions(false);
            close();
          }}
        />
        <SheetRow icon={Trash2} label={t('dm.clear')} danger onPress={askClear} />
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function SheetRow({ icon: Icon, label, onPress, danger }: { icon: LucideIcon; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: colors.pressed }]}>
      <Icon size={20} color={danger ? colors.danger : colors.inkMuted} />
      <Text tone={danger ? 'danger' : 'ink'}>{label}</Text>
    </Pressable>
  );
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function dayLabel(date: Date, t: T) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return t('dm.today');
  if (sameDay(date, yesterday)) return t('dm.yesterday');
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

const MEDIA_LABEL: Record<string, { key: 'dm.photo' | 'dm.video' | 'dm.audio'; icon: LucideIcon }> = {
  image: { key: 'dm.photo', icon: ImageIcon },
  video: { key: 'dm.video', icon: Video },
  audio: { key: 'dm.audio', icon: Mic },
};

const SWIPE_REPLY = 64;

function Bubble({
  message,
  older,
  newer,
  mine,
  userId,
  otherName,
  seen,
  selecting,
  selected,
  flash,
  onToggle,
  onReply,
  onJump,
}: {
  message: Message;
  older?: Message;
  newer?: Message;
  mine: boolean;
  userId?: string;
  otherName: string;
  seen: boolean;
  selecting: boolean;
  selected: boolean;
  flash: boolean;
  onToggle: (force?: boolean) => void;
  onReply: () => void;
  onJump: (id: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const at = new Date(message.created_at);
  const newDay = !older || !sameDay(at, new Date(older.created_at));
  const grouped = Boolean(newer && newer.sender_id === message.sender_id && sameDay(at, new Date(newer.created_at)));
  const media = message.revoked ? null : (message.media as MediaAsset | null);
  const ink = mine ? colors.onPrimary : colors.ink;
  const faint = mine ? 'rgba(255,255,255,0.75)' : colors.inkFaint;

  // Glisser la bulle vers la droite : répondre (comme WhatsApp).
  const shift = useRef(new Animated.Value(0)).current;
  const replyRef = useRef(onReply);
  replyRef.current = onReply;
  const swipable = !selecting && !message.revoked;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => swipable && g.dx > 12 && Math.abs(g.dy) < 10,
        onPanResponderMove: (_e, g) => shift.setValue(Math.max(0, Math.min(g.dx, SWIPE_REPLY + 16))),
        onPanResponderRelease: (_e, g) => {
          if (g.dx >= SWIPE_REPLY) {
            haptic.tap();
            replyRef.current();
          }
          Animated.spring(shift, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(shift, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [shift, swipable],
  );
  const hint = shift.interpolate({ inputRange: [0, SWIPE_REPLY], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View>
      {newDay ? (
        <View style={styles.day}>
          <Text variant="caption" tone="muted" style={[styles.dayPill, { backgroundColor: colors.background }]}>
            {dayLabel(at, t)}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={selecting ? () => onToggle() : undefined}
        onLongPress={() => {
          haptic.select();
          onToggle(true);
        }}
        delayLongPress={350}
        style={[
          styles.bubbleRow,
          { marginBottom: grouped ? 2 : 8 },
          (selected || flash) && { backgroundColor: colors.primarySoft },
        ]}
      >
        {selecting ? (
          <View style={[styles.check, selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.lineStrong }]}>
            {selected ? <Check size={12} color={colors.onPrimary} strokeWidth={3} /> : null}
          </View>
        ) : null}
        <Animated.View style={[styles.replyHint, { opacity: hint }]} pointerEvents="none">
          <Reply size={18} color={colors.inkMuted} />
        </Animated.View>
        <Animated.View {...pan.panHandlers} style={[styles.flex, mine ? styles.end : styles.start, { transform: [{ translateX: shift }] }]}>
          <View
            style={[
              styles.bubble,
              { backgroundColor: mine ? colors.primary : colors.background },
              !grouped && (mine ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }),
              media ? styles.mediaBubble : null,
            ]}
          >
            {message.revoked ? (
              <View style={styles.inline}>
                <Ban size={14} color={faint} />
                <Text variant="small" style={{ color: faint, fontStyle: 'italic' }}>
                  {mine ? t('dm.revoked_mine') : t('dm.revoked')}
                </Text>
              </View>
            ) : (
              <>
                {message.reply_to ? (
                  <Quote
                    quote={message.reply_to}
                    author={message.reply_to.sender_id === userId ? t('dm.you_name') : otherName}
                    onPrimary={mine}
                    onPress={selecting ? undefined : () => onJump(message.reply_to!.id)}
                  />
                ) : null}
                {media ? <ChatMedia media={media} mine={mine} /> : null}
                {message.body ? (
                  <Text selectable={!selecting} style={[{ color: ink }, media ? styles.caption : null]}>
                    {message.body}
                  </Text>
                ) : null}
              </>
            )}
            <View style={[styles.meta, media && !message.body ? styles.metaOnMedia : null]}>
              {message.edited_at && !message.revoked ? (
                <Text variant="caption" style={{ color: media && !message.body ? '#fff' : faint, fontSize: 11 }}>
                  {t('dm.edited')}
                </Text>
              ) : null}
              <Text variant="caption" style={{ color: media && !message.body ? '#fff' : faint, fontSize: 11 }}>
                {at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {mine && !message.revoked ? (
                seen ? (
                  <CheckCheck size={14} color={media && !message.body ? '#fff' : colors.onPrimary} />
                ) : (
                  <Check size={14} color={media && !message.body ? '#fff' : faint} />
                )
              ) : null}
            </View>
          </View>
        </Animated.View>
      </Pressable>
      {message.risk_note ? (
        <View style={[styles.risk, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <ShieldAlert size={16} color={colors.danger} />
          <Text variant="small" style={[styles.flexShrink, { color: colors.danger }]}>
            {t('dm.scam_warning', { note: message.risk_note })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Message cité : au-dessus d'une réponse, ou au-dessus de la saisie pendant qu'on répond. */
function Quote({ quote, author, onPrimary, onPress }: { quote: Quoted | Message; author: string; onPrimary?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const media = quote.media as MediaAsset | null;
  const kind = media ? MEDIA_LABEL[media.kind] : null;
  const thumb = media?.kind === 'image' && !quote.revoked ? absoluteUrl(media.urls.small ?? media.original_url) : null;
  const accent = onPrimary ? colors.onPrimary : colors.primary;
  const body = onPrimary ? 'rgba(255,255,255,0.85)' : colors.inkMuted;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.quote, { backgroundColor: onPrimary ? 'rgba(0,0,0,0.15)' : colors.container }]}
    >
      <View style={[styles.quoteBar, { backgroundColor: accent }]} />
      <View style={styles.quoteText}>
        <Text variant="smallStrong" numberOfLines={1} style={{ color: accent }}>
          {author}
        </Text>
        <View style={styles.inline}>
          {quote.revoked ? <Ban size={13} color={body} /> : kind ? <kind.icon size={13} color={body} /> : null}
          <Text variant="small" numberOfLines={2} style={[styles.flexShrink, { color: body, fontStyle: quote.revoked ? 'italic' : 'normal' }]}>
            {quote.revoked ? t('dm.revoked_short') : quote.body || (kind ? t(kind.key) : '')}
          </Text>
        </View>
      </View>
      {thumb ? <Image source={{ uri: thumb }} style={styles.quoteThumb} contentFit="cover" /> : null}
    </Pressable>
  );
}

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
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const send = useSendMessage(conversationId);
  const edit = useEditMessage(conversationId);
  const voice = useVoiceRecorder();
  const suggestions = useChatReplies();
  const input = useRef<TextInput>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const text = body.trim();

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
    if (replyTo || editing) input.current?.focus();
  }, [replyTo, editing]);

  const run = async (label: string, task: () => Promise<string | null>) => {
    setError(null);
    setBusy(label);
    try {
      const mediaId = await task();
      if (mediaId) {
        await send.mutateAsync({ media_id: mediaId, body: text, reply_to_id: replyTo?.id });
        setBody('');
        onCancelReply();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const startVoice = async () => {
    setError(null);
    try {
      await voice.start();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const sendVoice = () =>
    run(t('dm.sending_voice'), async () => {
      const uri = await voice.stop();
      return uri ? voice.upload(uri) : null;
    });

  const submit = () => {
    if (editing) {
      if ((!text && !editing.media) || edit.isPending) return;
      if (text === editing.body) return onCancelEdit();
      edit.mutate({ id: editing.id, body: text }, { onSuccess: onCancelEdit });
      return;
    }
    send.mutate(
      { body: text, reply_to_id: replyTo?.id },
      {
        onSuccess: () => {
          setBody('');
          onCancelReply();
        },
      },
    );
  };

  const failure = error ?? (send.isError ? errorMessage(send.error) : edit.isError ? errorMessage(edit.error) : null);

  return (
    <View style={[styles.bar, { borderTopColor: colors.line, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
      {failure ? (
        <Text variant="caption" tone="danger">
          {failure}
        </Text>
      ) : null}
      {busy ? (
        <View style={styles.inline}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text variant="caption" tone="muted">
            {busy}
          </Text>
        </View>
      ) : null}

      {suggestions.data?.replies.length && !editing && !text ? (
        <View style={styles.chips}>
          {suggestions.data.replies.map((reply) => (
            <Pressable
              key={reply}
              onPress={() => {
                haptic.select();
                setBody(reply);
                suggestions.reset();
                input.current?.focus();
              }}
              style={[styles.chip, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
            >
              <Text variant="small" numberOfLines={1}>
                {reply}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : suggestions.isError ? (
        <Text variant="caption" tone="danger">
          {errorMessage(suggestions.error)}
        </Text>
      ) : null}

      {replyTo || editing ? (
        <View style={[styles.context, { backgroundColor: colors.surface }]}>
          <View style={styles.flex}>
            {editing ? (
              <View style={styles.inline}>
                <Pencil size={16} color={colors.primary} />
                <View style={styles.flex}>
                  <Text variant="smallStrong" style={{ color: colors.primary }}>
                    {t('dm.editing')}
                  </Text>
                  <Text variant="small" tone="muted" numberOfLines={1}>
                    {editing.body}
                  </Text>
                </View>
              </View>
            ) : replyTo ? (
              <Quote quote={replyTo} author={replyTo.sender_id === userId ? t('dm.you_name') : otherName} />
            ) : null}
          </View>
          <IconButton icon={X} label={t('dm.cancel_reply')} size={18} onPress={editing ? onCancelEdit : onCancelReply} />
        </View>
      ) : null}

      {voice.recording ? (
        <View style={styles.inputRow}>
          <Pressable accessibilityLabel={t('dm.cancel_voice')} onPress={() => void voice.stop()} style={styles.iconButton}>
            <Trash2 size={21} color={colors.inkMuted} />
          </Pressable>
          <View style={[styles.recording, { backgroundColor: colors.dangerSoft }]}>
            <View style={[styles.recDot, { backgroundColor: colors.danger }]} />
            <Text variant="bodyStrong" style={{ color: colors.danger }}>
              {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
            </Text>
            <Text variant="small" tone="muted">
              {t('dm.recording')}
            </Text>
          </View>
          <Pressable accessibilityLabel={t('dm.send')} onPress={() => void sendVoice()} style={[styles.send, { backgroundColor: colors.primary }]}>
            <SendHorizontal size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputRow}>
          {!editing ? (
            <Pressable
              accessibilityLabel={t('dm.attach')}
              disabled={Boolean(busy)}
              onPress={() => void run(t('dm.sending_media'), pickAndUploadMedia)}
              style={styles.iconButton}
            >
              <ImagePlus size={22} color={colors.inkMuted} />
            </Pressable>
          ) : null}
          {!editing ? (
            <Pressable
              accessibilityLabel={t('dm.suggest')}
              disabled={suggestions.isPending}
              onPress={() => suggestions.mutate(conversationId)}
              style={styles.iconButton}
            >
              {suggestions.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Sparkles size={21} color={colors.inkMuted} />}
            </Pressable>
          ) : null}
          <TextInput
            ref={input}
            value={body}
            onChangeText={setBody}
            placeholder={editing ? t('dm.editing') : t('dm.placeholder')}
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.primary}
            multiline
            maxLength={2000}
            style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.container }]}
          />
          {editing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('dm.save_edit')}
              disabled={edit.isPending || (!text && !editing.media)}
              onPress={submit}
              style={[styles.send, { backgroundColor: colors.primary, opacity: edit.isPending ? 0.5 : 1 }]}
            >
              <Check size={20} color={colors.onPrimary} />
            </Pressable>
          ) : text ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('dm.send')}
              disabled={send.isPending || Boolean(busy)}
              onPress={submit}
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              <SendHorizontal size={18} color={colors.onPrimary} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel={t('dm.voice')}
              disabled={Boolean(busy)}
              onPress={() => void startVoice()}
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              <Mic size={20} color={colors.onPrimary} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  risk: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginHorizontal: 8, marginBottom: 8, padding: 10, borderRadius: radius.md, maxWidth: '85%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
  grow: { flexGrow: 1 },
  strong: { fontWeight: '700' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  topBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  topInner: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 4 },
  peer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  thread: { paddingHorizontal: 8, paddingVertical: 10, flexGrow: 1 },
  hello: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  sayHi: { marginTop: 8 },
  day: { alignItems: 'center', paddingVertical: 8 },
  dayPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, overflow: 'hidden', textTransform: 'capitalize' },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, borderRadius: 8 },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  replyHint: { position: 'absolute', left: 8 },
  start: { alignItems: 'flex-start' },
  end: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', minWidth: 84, borderRadius: radius.lg + 2, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4, gap: 4 },
  mediaBubble: { padding: 3, paddingTop: 3, paddingBottom: 3 },
  caption: { paddingHorizontal: 6, paddingTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4 },
  metaOnMedia: { position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  quote: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', minWidth: 160 },
  quoteBar: { width: 4 },
  quoteText: { flex: 1, paddingHorizontal: 8, paddingVertical: 5, gap: 1 },
  quoteThumb: { width: 52, height: 52 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, minHeight: 52 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingTop: 8, gap: 6 },
  context: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, borderRadius: radius.md },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 21, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  recording: { flex: 1, height: 42, borderRadius: 21, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  recDot: { width: 10, height: 10, borderRadius: 5 },
});
