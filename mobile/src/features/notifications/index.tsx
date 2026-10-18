import { type InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Bell, CheckCheck, CheckCircle2, Heart, MessageSquare, Sparkles, Trash2, UserPlus } from 'lucide-react-native';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { api, errorMessage, type Schemas, unwrap } from '@/shared/api';
import { goToRoute, notificationRoute, notificationWebUrl, openLink, timeAgo } from '@/shared/lib';
import { useT } from '@/shared/i18n';
import { AppearItem, haptic } from '@/shared/motion';
import { type Page, useInfiniteList } from '@/shared/query';
import { useSession } from '@/shared/session';
import { useTheme } from '@/shared/theme';
import { EmptyState, ErrorState, Header, IconButton, ListFooter, Loading, Text, useToast } from '@/shared/ui';

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

type NotificationPages = InfiniteData<Page<Notification>>;

/** Retire la notification de la liste tout de suite (et du compteur si elle n'était pas lue). */
function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notification: Notification) =>
      unwrap(api.DELETE('/api/notifications/{notification_id}/', { params: { path: { notification_id: notification.id } } })),
    onMutate: async (notification) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'list'] });
      const previous = queryClient.getQueryData<NotificationPages>(['notifications', 'list']);
      queryClient.setQueryData<NotificationPages>(['notifications', 'list'], (data) =>
        data
          ? { ...data, pages: data.pages.map((page) => ({ ...page, results: page.results.filter((item) => item.id !== notification.id) })) }
          : data,
      );
      if (!notification.read_at) {
        queryClient.setQueryData<{ unread: number }>(UNREAD_KEY, (data) => (data ? { unread: Math.max(0, data.unread - 1) } : data));
      }
      return { previous };
    },
    onError: (_error, _notification, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', 'list'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

/** Efface toutes les notifications du membre. */
function useClearNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.DELETE('/api/notifications/')),
    onMutate: () => {
      queryClient.setQueryData<NotificationPages>(['notifications', 'list'], (data) =>
        data ? { ...data, pages: data.pages.map((page) => ({ ...page, results: [], next: null })) } : data,
      );
      queryClient.setQueryData<{ unread: number }>(UNREAD_KEY, (data) => (data ? { unread: 0 } : data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

const hrefOf = (notification: Notification) => notificationRoute(notification.data);

const ICONS: Partial<Record<Notification['kind'], typeof Bell>> = {
  new_comment: MessageSquare,
  comment_reply: AtSign,
  post_liked: Heart,
  new_answer: MessageSquare,
  answer_accepted: CheckCircle2,
  ai_answer_ready: Sparkles,
  new_follower: UserPlus,
};

function NotificationRow({ notification, onOpen, onDelete }: { notification: Notification; onOpen: () => void; onDelete: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const Icon = ICONS[notification.kind] ?? Bell;
  const unread = !notification.read_at;
  return (
    <Pressable
      onPress={onOpen}
      onLongPress={onDelete}
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
      <View style={styles.side}>
        {unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
        <IconButton icon={Trash2} label={t('notif.delete')} size={17} color={colors.inkFaint} onPress={onDelete} />
      </View>
    </Pressable>
  );
}

export function NotificationsScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const list = useNotifications();
  const markRead = useMarkRead();
  const remove = useDeleteNotification();
  const clear = useClearNotifications();
  const toast = useToast();
  const hasUnread = list.items.some((item) => !item.read_at);

  const deleteOne = (notification: Notification) => {
    haptic.tap();
    remove.mutate(notification, { onError: (error) => toast(errorMessage(error), 'error') });
  };
  const confirmClear = () =>
    Alert.alert(t('notif.clear_confirm'), t('notif.clear_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('notif.clear_all'),
        style: 'destructive',
        onPress: () =>
          clear.mutate(undefined, {
            onSuccess: () => toast(t('notif.cleared')),
            onError: (error) => toast(errorMessage(error), 'error'),
          }),
      },
    ]);

  const open = (notification: Notification) => {
    if (!notification.read_at) markRead.mutate(notification);
    const href = hrefOf(notification);
    const web = notificationWebUrl(notification.data);
    if (href) goToRoute(href);
    else if (web) void openLink(web);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={t('nav.notifications')}
        back
        right={
          <>
            {hasUnread ? <IconButton icon={CheckCheck} label={t('notif.mark_all')} onPress={() => markRead.mutate('all')} /> : null}
            {list.items.length ? <IconButton icon={Trash2} label={t('notif.clear_all')} onPress={confirmClear} /> : null}
          </>
        }
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
              <NotificationRow notification={item} onOpen={() => open(item)} onDelete={() => deleteOne(item)} />
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
  side: { alignItems: 'center', gap: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
});
