import { Image } from 'expo-image';
import { router } from 'expo-router';
import { CalendarDays, GitBranch, Info, Link2, MapPin, Pencil, Share2, Sparkles, UserCheck } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { useOpenConversation } from '@/features/messaging/api';
import { absoluteUrl, errorMessage } from '@/shared/api';
import { useDataSaver } from '@/shared/data-saver';
import { t } from '@/shared/i18n';
import { formatCount, monthYear, openLink, profileColorHex } from '@/shared/lib';
import { haptic, PressableScale } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { useTheme } from '@/shared/theme';
import { Avatar, Button, ListFooter, Markdown, Sheet, Text, useToast } from '@/shared/ui';

import { type PublicProfile, useFollow, useFollowList } from './api';
import { SPECIAL_BADGES } from './badges';
import { OpenToWork, shareProfile } from './sections';
import { SocialLinks } from './social';

/**
 * En-tête façon TikTok : nom en grand et @pseudo à gauche, avatar rond à droite, compteurs
 * Suivis / Followers / J'aime, puis Suivre · Message · partager, et la bio.
 * La bannière (facultative) s'affiche en bandeau au-dessus.
 */
export function ProfileHeader({ profile, isMe }: { profile: PublicProfile; isMe: boolean }) {
  const { colors } = useTheme();
  const { textOnly } = useDataSaver();
  const name = profile.display_name || profile.username;
  const accent = profileColorHex(profile.username, profile.accent_color);
  const banner = textOnly ? undefined : absoluteUrl(profile.banner_url);
  const special = profile.badges.filter((badge) => badge.code in SPECIAL_BADGES);

  return (
    <View>
      {banner ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.banner}>
          <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        </Animated.View>
      ) : null}

      <View style={styles.body}>
        <Animated.View entering={FadeInDown.duration(320)} style={styles.top}>
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.ink }]} numberOfLines={2}>
                {name}
              </Text>
              {special.map((badge) => {
                const { icon: Icon, color } = SPECIAL_BADGES[badge.code]!;
                return (
                  <View key={badge.code} accessibilityLabel={badge.label} style={[styles.special, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                    <Icon size={13} color={color} />
                  </View>
                );
              })}
            </View>
            <Text tone="muted" style={styles.handle}>
              @{profile.username}
            </Text>
            <StatsBar profile={profile} accent={accent} />
          </View>
          <Animated.View entering={ZoomIn.springify().damping(14).delay(80)}>
            <Avatar name={name} src={profile.avatar_url} color={accent} size={96} />
          </Animated.View>
        </Animated.View>

        <View style={styles.actions}>
          {isMe ? (
            <View style={styles.flex}>
              <Button label={t('profile.edit_mine')} icon={Pencil} variant="primary" block onPress={() => router.push('/edit-profile')} />
            </View>
          ) : (
            <>
              <View style={styles.flex}>
                <FollowButton profile={profile} />
              </View>
              <View style={styles.flex}>
                <MessageButton username={profile.username} />
              </View>
            </>
          )}
          <PressableScale
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={t('feed.share')}
            onPress={() => shareProfile(profile.username, name)}
            style={[styles.round, { backgroundColor: colors.container }]}
          >
            <Share2 size={19} color={colors.ink} />
          </PressableScale>
        </View>

        {profile.bio ? (
          <View style={styles.bio}>
            <Markdown source={profile.bio} />
          </View>
        ) : null}

        <SocialLinks links={profile.social_links} />

        <View style={styles.facts}>
          {profile.location ? (
            <View style={styles.inline}>
              <MapPin size={14} color={colors.inkFaint} />
              <Text variant="small" tone="muted">
                {profile.location}
              </Text>
            </View>
          ) : null}
          <View style={styles.inline}>
            <CalendarDays size={14} color={colors.inkFaint} />
            <Text variant="small" tone="muted">
              {t('profile.since', { date: monthYear(profile.created_at) })}
            </Text>
          </View>
          {profile.github_username && !profile.social_links?.github ? (
            <PressableScale scaleTo={0.97} style={styles.inline} onPress={() => void openLink(`https://github.com/${profile.github_username}`)}>
              <GitBranch size={14} color={colors.inkFaint} />
              <Text variant="smallStrong">{profile.github_username}</Text>
            </PressableScale>
          ) : null}
          {profile.website ? (
            <PressableScale scaleTo={0.97} style={styles.inline} onPress={() => void openLink(profile.website)}>
              <Link2 size={14} color={colors.inkFaint} />
              <Text variant="smallStrong" numberOfLines={1}>
                {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </Text>
            </PressableScale>
          ) : null}
        </View>
        <View style={styles.otw}>
          <OpenToWork profile={profile} />
        </View>
      </View>
    </View>
  );
}

function FollowButton({ profile }: { profile: PublicProfile }) {
  const { isAuthenticated } = useSession();
  const follow = useFollow(profile.username);
  const toast = useToast();
  const following = profile.is_following;
  return (
    <Button
      label={t(following ? 'profile.following_state' : 'profile.follow')}
      icon={following ? UserCheck : undefined}
      variant={following ? 'secondary' : 'primary'}
      block
      onPress={() => {
        if (!isAuthenticated) {
          router.push('/login');
          return;
        }
        haptic.tap();
        follow.mutate(!following, { onError: (error) => toast(errorMessage(error), 'error') });
      }}
    />
  );
}

/** Ouvre (ou crée) la conversation privée avec ce membre. */
function MessageButton({ username }: { username: string }) {
  const { isAuthenticated } = useSession();
  const toast = useToast();
  const open = useOpenConversation();
  return (
    <Button
      label={t('dm.message')}
      variant="secondary"
      block
      loading={open.isPending}
      onPress={() => {
        if (!isAuthenticated) {
          router.push('/login');
          return;
        }
        open.mutate(username, {
          onSuccess: (conversation) => router.push(`/messages/${conversation.id}`),
          onError: (error) => toast(errorMessage(error), 'error'),
        });
      }}
    />
  );
}

/** « 946 Suivis · 16 478 Followers · 270 332 J'aime » puis le Craft Score (détail au toucher). */
function StatsBar({ profile, accent }: { profile: PublicProfile; accent: string }) {
  const { colors } = useTheme();
  const [list, setList] = useState<'followers' | 'following' | null>(null);
  const [craftOpen, setCraftOpen] = useState(false);
  const likes = (profile.craft.creation.breakdown.post_upvotes ?? 0) + (profile.craft.help.breakdown.answer_upvotes ?? 0);
  const cells = [
    { key: 'following', value: profile.following_count, label: t('profile.following_short'), onPress: () => setList('following') },
    { key: 'followers', value: profile.followers_count, label: t('profile.followers_short'), onPress: () => setList('followers') },
    { key: 'likes', value: likes, label: t('profile.likes'), onPress: undefined },
  ];
  return (
    <>
      <View style={styles.stats}>
        {cells.map((cell) => (
          <PressableScale
            key={cell.key}
            scaleTo={0.94}
            onPress={cell.onPress}
            disabled={!cell.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${formatCount(cell.value)} ${cell.label}`}
            style={styles.stat}
          >
            <Text style={[styles.statValue, { color: colors.ink }]}>{formatCount(cell.value)}</Text>
            <Text variant="small" tone="muted">
              {cell.label}
            </Text>
          </PressableScale>
        ))}
      </View>
      <PressableScale scaleTo={0.96} onPress={() => setCraftOpen(true)} style={[styles.craft, { backgroundColor: colors.container }]}>
        <Sparkles size={13} color={accent} />
        <Text variant="caption" style={{ color: accent, fontWeight: '700' }}>
          {formatCount(profile.craft.score)}
        </Text>
        <Text variant="caption" tone="muted">
          {t('profile.karma')}
        </Text>
        <Info size={11} color={colors.inkFaint} />
      </PressableScale>
      <CraftSheet profile={profile} visible={craftOpen} onClose={() => setCraftOpen(false)} />
      <FollowSheet username={profile.username} kind={list} onClose={() => setList(null)} />
    </>
  );
}

/** Infobulle mobile du Craft Score : Entraide vs Création. */
function CraftSheet({ profile, visible, onClose }: { profile: PublicProfile; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { craft } = profile;
  const total = Math.max(1, craft.help.score + craft.creation.score);
  return (
    <Sheet visible={visible} onClose={onClose} title={`${t('profile.karma')} · ${formatCount(craft.score)}`}>
      <View style={styles.sheetBody}>
        <View style={[styles.split, { backgroundColor: colors.containerHigh }]}>
          <View style={{ flex: craft.help.score / total, backgroundColor: colors.secondary }} />
          <View style={{ flex: craft.creation.score / total, backgroundColor: colors.primary }} />
        </View>
        {[
          { label: t('profile.craft_help'), value: craft.help.score, color: colors.secondary },
          { label: t('profile.craft_creation'), value: craft.creation.score, color: colors.primary },
        ].map((row) => (
          <View key={row.label} style={styles.splitRow}>
            <View style={[styles.dot, { backgroundColor: row.color }]} />
            <Text style={styles.flex}>{row.label}</Text>
            <Text variant="bodyStrong">{formatCount(row.value)}</Text>
          </View>
        ))}
        <Text variant="caption" tone="faint">
          {t('profile.craft_rules')}
        </Text>
      </View>
    </Sheet>
  );
}

function FollowSheet({ username, kind, onClose }: { username: string; kind: 'followers' | 'following' | null; onClose: () => void }) {
  const { colors } = useTheme();
  const list = useFollowList(username, kind ?? 'followers', kind !== null);
  // Profil choisi : ouvert une fois la feuille refermée, sinon il s'affiche sous elle.
  const pending = useRef<string | null>(null);
  const openPending = () => {
    const target = pending.current;
    pending.current = null;
    if (target) router.push(`/u/${encodeURIComponent(target)}`);
  };
  return (
    <Sheet
      visible={kind !== null}
      onClose={onClose}
      onHidden={openPending}
      title={t(kind === 'following' ? 'profile.following_count' : 'profile.followers_count')}
    >
      <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetBody}>
        {list.isPending ? (
          <ListFooter loading />
        ) : list.items.length ? (
          list.items.map((member) => (
            <PressableScale
              key={member.id}
              scaleTo={0.98}
              onPress={() => {
                pending.current = member.username;
                onClose();
              }}
              style={styles.member}
            >
              <Avatar name={member.display_name} src={member.avatar_url} size={42} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {member.display_name}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  @{member.username}
                  {member.stack.length ? ` · ${member.stack.join(', ')}` : ''}
                </Text>
              </View>
              {member.is_following ? (
                <Text variant="caption" tone="faint">
                  {t('profile.followed_by_me')}
                </Text>
              ) : null}
            </PressableScale>
          ))
        ) : (
          <Text tone="muted" style={[styles.center, { color: colors.inkMuted }]}>
            {t(kind === 'following' ? 'profile.empty.following' : 'profile.empty.followers')}
          </Text>
        )}
        {list.hasNextPage ? <Button label={t('common.see_more')} variant="ghost" loading={list.isFetchingNextPage} onPress={list.loadMore} /> : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  banner: { height: 120, overflow: 'hidden' },
  body: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  identity: { flex: 1, gap: 2 },
  name: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  handle: { fontSize: 16 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  special: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stats: { flexDirection: 'row', gap: 22, marginTop: 12 },
  stat: { gap: 1 },
  statValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  craft: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  bio: { alignSelf: 'stretch' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  otw: { alignSelf: 'stretch' },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  sheetList: { maxHeight: 460 },
  split: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
