import { type InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { AtSign, Bell, CheckCheck, CheckCircle2, Heart, MessageSquare, Sparkles } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { api, type Schemas, unwrap } from '@/shared/api';
import { timeAgo } from '@/shared/lib';
import { useT } from '@/shared/i18n';
import { AppearItem } from '@/shared/motion';
import { type Page, useInfiniteList } from '@/shared/query';
import { useSession } from '@/shared/session';
import { useTheme } from '@/shared/theme';
import { EmptyState, ErrorState, Header, IconButton, ListFooter, Loading, Text } from '@/shared/ui';

type Notification = Schemas['Notification'];

const UNREAD_KEY = ['notifications', 'unread'] as const;

export function useUnreadCount() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => unwrap(api.GET('/api/notifications/unread-count/')),
    enabled: isAuthenticated,
    refetchInterval: 120_000,
    select: (data) => data.unread,
  });
}

function useNotifications() {
  return useInfiniteList(['notifications', 'list'], (cursor) =>
    unwrap(api.GET('/api/notifications/', { params: { query: { cursor } } })),
  );
}

/** Marque lu tout de suite dans la liste et le compteur, puis resynchronise. */
function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (target: Notification | 'all') => {
      if (target === 'all') await unwrap(api.POST('/api/notifications/read-all/'));
      else await unwrap(api.POST('/api/notifications/{notification_id}/read/', { params: { path: { notification_id: target.id } } }));
    },
    onMutate: (target) => {
      const now = new Date().toISOString();
      queryClient.setQueryData<InfiniteData<Page<Notification>>>(['notifications', 'list'], (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                results: page.results.map((item) =>
                  target === 'all' || item.id === target.id ? { ...item, read_at: item.read_at ?? now } : item,
                ),
              })),
            }
          : data,
      );
      queryClient.setQueryData<{ unread: number }>(UNREAD_KEY, (data) =>
        data ? { unread: target === 'all' ? 0 : Math.max(0, data.unread - (target.read_at ? 0 : 1)) } : data,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

/** data = {type, id} : écran concerné (posts et questions ont un écran sur mobile). */
function hrefOf(notification: Notification): string | null {
  const data = (notification.data ?? {}) as { type?: string; id?: string };
  if (!data.id) return null;
  if (data.type === 'post') return `/post/${data.id}`;
  if (data.type === 'question') return `/question/${data.id}`;
  return null;
}

const ICONS: Partial<Record<Notification['kind'], typeof Bell>> = {
  new_comment: MessageSquare,
  comment_reply: AtSign,
  post_liked: Heart,
  new_answer: MessageSquare,
  answer_accepted: CheckCircle2,
  ai_answer_ready: Sparkles,
};

function NotificationRow({ notification, onOpen }: { notification: Notification; onOpen: () => void }) {
  const { colors } = useTheme();
  const Icon = ICONS[notification.kind] ?? Bell;
  const unread = !notification.read_at;
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.line, backgroundColor: pressed ? colors.pressed : unread ? colors.surface : colors.background },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: unread ? colors.primarySoft : colors.container }]}>
        <Icon size={18} color={unread ? colors.primaryInk : colors.inkMuted} />
      </View>
      <View style={styles.body}>
        <Text variant={unread ? 'bodyStrong' : 'body'} numberOfLines={2}>
          {notification.title}
        </Text>
        {notification.body ? (
          <Text variant="small" tone="muted" numberOfLines={2}>
            {notification.body}
          </Text>
        ) : null}
        <Text variant="caption" tone="faint">
          {timeAgo(notification.created_at)}
        </Text>
      </View>
      {unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
    </Pressable>
  );
}

export function NotificationsScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const list = useNotifications();
  const markRead = useMarkRead();
  const hasUnread = list.items.some((item) => !item.read_at);

  const open = (notification: Notification) => {
    if (!notification.read_at) markRead.mutate(notification);
    const href = hrefOf(notification);
    if (href) router.push(href);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={t('nav.notifications')}
        back
        right={hasUnread ? <IconButton icon={CheckCheck} label={t('notif.mark_all')} onPress={() => markRead.mutate('all')} /> : null}
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError && !list.items.length ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <AppearItem index={index}>
              <NotificationRow notification={item} onOpen={() => open(item)} />
            </AppearItem>
          )}
          onEndReached={list.loadMore}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching && !list.isFetchingNextPage}
              onRefresh={() => void list.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={<EmptyState icon={Bell} title={t('notif.empty')} body={t('notif.empty_body')} />}
          ListFooterComponent={<ListFooter loading={list.isFetchingNextPage} />}
          contentContainerStyle={styles.grow}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
});
