import { router, useLocalSearchParams } from 'expo-router';
import { Ban, Crown, Ellipsis, Search, ShieldCheck, ShieldOff, UserMinus, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { timeAgo } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Avatar, Button, EmptyState, ErrorState, Header, IconButton, ListFooter, Loading, Sheet, Text, useToast } from '@/shared/ui';

import { type Hub, type HubBan, type HubMember, useHub, useHubBans, useHubMembers, useMemberActions } from './api';

type Row = { kind: 'member'; member: HubMember } | { kind: 'title' } | { kind: 'ban'; ban: HubBan };

/** Choix d'actions sur un membre, dans une feuille du bas. */
function MemberSheet({ hub, member, onClose }: { hub: Hub; member: HubMember | null; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const { remove, promote, demote } = useMemberActions(hub.slug);
  if (!member) return null;
  const name = member.user.username;
  const isCreatorViewer = Boolean(hub.viewer?.is_creator);
  const isModerator = member.role === 'moderator';

  const run = (promise: Promise<unknown>, done: string) => {
    onClose();
    promise
      .then(() => {
        haptic.success();
        toast(done);
      })
      .catch((error: unknown) => toast(errorMessage(error), 'error'));
  };
  const confirm = (title: string, body: string, action: () => void) =>
    Alert.alert(title, body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), style: 'destructive', onPress: action },
    ]);

  const actions: { label: string; icon: typeof Ban; danger?: boolean; onPress: () => void }[] = [];
  if (isCreatorViewer) {
    actions.push(
      isModerator
        ? { label: t('hubs.demote'), icon: ShieldOff, onPress: () => run(demote.mutateAsync(name), t('hubs.demoted', { name })) }
        : { label: t('hubs.promote'), icon: ShieldCheck, onPress: () => run(promote.mutateAsync(name), t('hubs.promoted', { name })) },
    );
  }
  actions.push(
    {
      label: t('hubs.remove'),
      icon: UserMinus,
      onPress: () => confirm(t('hubs.remove'), t('hubs.remove_body', { name }), () => run(remove.mutateAsync({ username: name }), t('hubs.removed', { name }))),
    },
    {
      label: t('hubs.ban'),
      icon: Ban,
      danger: true,
      onPress: () => confirm(t('hubs.ban'), t('hubs.ban_body', { name }), () => run(remove.mutateAsync({ username: name, ban: true }), t('hubs.banned', { name }))),
    },
  );

  return (
    <Sheet visible onClose={onClose} title={`@${name}`}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.pressed }]}
        >
          <action.icon size={20} color={action.danger ? colors.danger : colors.ink} />
          <Text variant="bodyStrong" style={action.danger ? { color: colors.danger } : null}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </Sheet>
  );
}

function MemberRow({ hub, member, onManage }: { hub: Hub; member: HubMember; onManage: (member: HubMember) => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const { user } = useSession();
  const isModerator = member.role === 'moderator';
  const manageable = !member.is_creator && member.user.id !== user?.id && (!isModerator || Boolean(hub.viewer?.is_creator));
  const name = member.user.display_name || member.user.username;
  return (
    <Pressable
      onPress={() => router.push(`/u/${member.user.username}`)}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed && { backgroundColor: colors.pressed }]}
    >
      <Avatar name={name} src={member.user.avatar_url} size={40} />
      <View style={styles.flex}>
        <View style={styles.inline}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
            {name}
          </Text>
          {member.is_creator ? (
            <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
              <Crown size={11} color={colors.primaryInk} />
              <Text variant="caption" style={[styles.badgeText, { color: colors.primaryInk }]}>
                {t('mod.creator')}
              </Text>
            </View>
          ) : isModerator ? (
            <View style={[styles.badge, { backgroundColor: colors.secondarySoft }]}>
              <ShieldCheck size={11} color={colors.secondaryInk} />
              <Text variant="caption" style={[styles.badgeText, { color: colors.secondaryInk }]}>
                {t('mod.moderator')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption" tone="faint" numberOfLines={1}>
          @{member.user.username} · {t('hubs.member_since', { ago: timeAgo(member.joined_at) })}
        </Text>
      </View>
      {manageable ? <IconButton icon={Ellipsis} label={t('mod.actions')} onPress={() => onManage(member)} /> : null}
    </Pressable>
  );
}

function BanRow({ slug, ban }: { slug: string; ban: HubBan }) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const { lift } = useMemberActions(slug);
  const name = ban.user.username;
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <Avatar name={ban.user.display_name || name} src={ban.user.avatar_url} size={36} />
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          @{name}
        </Text>
        <Text variant="caption" tone="faint" numberOfLines={2}>
          {timeAgo(ban.banned_at)}
          {ban.reason ? ` · ${ban.reason}` : ''}
        </Text>
      </View>
      <Button
        label={t('hubs.lift_ban')}
        variant="secondary"
        size="sm"
        loading={lift.isPending}
        onPress={() =>
          lift.mutate(name, {
            onSuccess: () => toast(t('hubs.lifted', { name })),
            onError: (error) => toast(errorMessage(error), 'error'),
          })
        }
      />
    </View>
  );
}

/** Membres d'un hub pour sa modération : recherche, rôles, retrait, exclusion. */
export function HubMembersScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { t } = useT();
  const hub = useHub(slug);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [managing, setManaging] = useState<HubMember | null>(null);
  const members = useHubMembers(slug, q);
  const bans = useHubBans(slug);

  useEffect(() => {
    const timer = setTimeout(() => setQ(draft.trim().replace(/^@/, '')), 350);
    return () => clearTimeout(timer);
  }, [draft]);

  if (!hub.data) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Header title={t('hubs.members_title')} back />
        {hub.isPending ? <Loading /> : <ErrorState error={hub.error} onRetry={() => void hub.refetch()} />}
      </View>
    );
  }

  const rows: Row[] = [
    ...members.items.map((member) => ({ kind: 'member' as const, member })),
    ...(bans.items.length && !q ? [{ kind: 'title' as const }, ...bans.items.map((ban) => ({ kind: 'ban' as const, ban }))] : []),
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header title={`${t('hubs.members_title')} · h/${hub.data.slug}`} back />
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.container }]}>
          <Search size={18} color={colors.inkFaint} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('hubs.members_search')}
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.primary}
            autoCapitalize="none"
            style={[typography.body, styles.input, { color: colors.ink }]}
          />
        </View>
        <Text variant="caption" tone="faint">
          {t('hubs.members_hint')}
        </Text>
      </View>
      {members.isError && !members.items.length ? (
        <ErrorState error={members.error} onRetry={() => void members.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, index) => (row.kind === 'member' ? `m-${row.member.user.id}` : row.kind === 'ban' ? `b-${row.ban.user.id}` : `t-${index}`)}
          renderItem={({ item }) =>
            item.kind === 'member' ? (
              <MemberRow hub={hub.data} member={item.member} onManage={setManaging} />
            ) : item.kind === 'ban' ? (
              <BanRow slug={slug} ban={item.ban} />
            ) : (
              <Text variant="smallStrong" tone="muted" style={styles.section}>
                {t('hubs.bans_title')}
              </Text>
            )
          }
          onEndReached={members.loadMore}
          keyboardDismissMode="on-drag"
          ListEmptyComponent={members.isPending ? <ListFooter loading /> : <EmptyState icon={Users} title={t('hubs.members_none')} />}
          ListFooterComponent={<ListFooter loading={members.isFetchingNextPage} />}
          contentContainerStyle={styles.grow}
        />
      )}
      <MemberSheet hub={hub.data} member={managing} onClose={() => setManaging(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, gap: 2 },
  grow: { flexGrow: 1, paddingBottom: 32 },
  shrink: { flexShrink: 1 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: radius.pill, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
});
