import { router, useLocalSearchParams } from 'expo-router';
import { ImagePlus, MessageCircle, Mic, SendHorizontal, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, type Schemas } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { timeAgo } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Avatar, EmptyState, ErrorState, Header, ListFooter, Loading, Text } from '@/shared/ui';

import { type Conversation, type Message, useConversation, useInbox, useMarkRead, useSendMessage, useThread } from './api';
import { ChatMedia, pickAndUploadMedia, useVoiceRecorder } from './media';

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
  return (
    <Pressable
      onPress={() => router.push(`/messages/${conversation.id}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressed }]}
    >
      <Avatar name={name} src={other?.avatar_url} size={52} />
      <View style={styles.flex}>
        <Text variant={unread ? 'bodyStrong' : 'body'} numberOfLines={1}>
          {name}
        </Text>
        <Text variant="small" tone={unread ? 'ink' : 'muted'} numberOfLines={1} style={unread ? styles.strong : null}>
          {conversation.last_message_mine ? `${t('dm.you')} ` : ''}
          {conversation.last_message_preview}
          {conversation.last_message_at ? ` · ${timeAgo(conversation.last_message_at)}` : ''}
        </Text>
      </View>
      {unread ? (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text variant="caption" style={{ color: colors.onPrimary, fontWeight: '700' }}>
            {conversation.unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Fil d'une conversation : bulles, « Vu », saisie collée au clavier. */
export function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useT();
  const { user } = useSession();
  const conversation = useConversation(id);
  const thread = useThread(id);
  const markRead = useMarkRead();
  const other = conversation.data?.other;
  const name = other?.display_name || other?.username || t('member');
  const newest = thread.items[0];

  const lastMarked = useRef<string | null>(null);
  useEffect(() => {
    if (!newest || newest.sender_id === user?.id || lastMarked.current === newest.id) return;
    lastMarked.current = newest.id;
    markRead.mutate(id);
  }, [id, markRead, newest, user?.id]);

  const otherReadAt = conversation.data?.other_read_at ? new Date(conversation.data.other_read_at).getTime() : 0;
  const lastMine = thread.items.find((message) => message.sender_id === user?.id);
  const seenId = lastMine && otherReadAt >= new Date(lastMine.created_at).getTime() ? lastMine.id : null;

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={name}
        back
        right={
          other ? (
            <Pressable onPress={() => router.push(`/u/${other.username}`)} accessibilityLabel={name} style={styles.headerAvatar}>
              <Avatar name={name} src={other.avatar_url} size={32} />
            </Pressable>
          ) : null
        }
      />
      {thread.isPending ? (
        <Loading />
      ) : (
        <FlatList
          inverted
          data={thread.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <Bubble message={item} mine={item.sender_id === user?.id} seen={item.id === seenId} />}
          onEndReached={thread.loadMore}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            other ? (
              <View style={[styles.hello, { transform: [{ scaleY: -1 }] }]}>
                <Avatar name={name} src={other.avatar_url} size={72} />
                <Text variant="bodyStrong">{name}</Text>
                <Text tone="muted">{t('dm.say_hi')}</Text>
              </View>
            ) : null
          }
          ListFooterComponent={<ListFooter loading={thread.isFetchingNextPage} />}
        />
      )}
      <Composer conversationId={id} />
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, mine, seen }: { message: Message; mine: boolean; seen: boolean }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={[styles.bubbleRow, mine ? styles.end : styles.start]}>
      {message.media ? <ChatMedia media={message.media as Schemas['MediaOutput']} mine={mine} /> : null}
      {message.body ? (
        <View
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
              : { backgroundColor: colors.container, borderBottomLeftRadius: 6 },
          ]}
        >
          <Text selectable style={{ color: mine ? colors.onPrimary : colors.ink }}>
            {message.body}
          </Text>
        </View>
      ) : null}
      {seen ? (
        <Text variant="caption" tone="faint">
          {t('dm.seen')}
        </Text>
      ) : null}
    </View>
  );
}

function Composer({ conversationId }: { conversationId: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const send = useSendMessage(conversationId);
  const voice = useVoiceRecorder();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = body.trim();

  const run = async (label: string, task: () => Promise<string | null>) => {
    setError(null);
    setBusy(label);
    try {
      const mediaId = await task();
      if (mediaId) await send.mutateAsync({ media_id: mediaId });
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

  const failure = error ?? (send.isError ? errorMessage(send.error) : null);

  return (
    <View style={[styles.bar, { borderTopColor: colors.line, paddingBottom: insets.bottom + 8 }]}>
      {failure ? (
        <Text variant="caption" tone="danger">
          {failure}
        </Text>
      ) : null}
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text variant="caption" tone="muted">
            {busy}
          </Text>
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
          <Pressable
            accessibilityLabel={t('dm.attach')}
            disabled={Boolean(busy)}
            onPress={() => void run(t('dm.sending_media'), pickAndUploadMedia)}
            style={styles.iconButton}
          >
            <ImagePlus size={22} color={colors.inkMuted} />
          </Pressable>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={t('dm.placeholder')}
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.primary}
            multiline
            maxLength={2000}
            style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.container }]}
          />
          {text ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('dm.send')}
              disabled={send.isPending}
              onPress={() => send.mutate({ body: text }, { onSuccess: () => setBody('') })}
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              <SendHorizontal size={18} color={colors.onPrimary} />
            </Pressable>
          ) : (
            <Pressable accessibilityLabel={t('dm.voice')} disabled={Boolean(busy)} onPress={() => void startVoice()} style={styles.iconButton}>
              <Mic size={22} color={colors.inkMuted} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  strong: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { marginRight: 12 },
  thread: { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
  hello: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  bubbleRow: { marginVertical: 3, gap: 2 },
  start: { alignItems: 'flex-start' },
  end: { alignItems: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: radius.lg + 4, paddingHorizontal: 14, paddingVertical: 9 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 21, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recording: { flex: 1, height: 42, borderRadius: 21, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  recDot: { width: 10, height: 10, borderRadius: 5 },
});
