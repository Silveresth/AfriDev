import { Image } from 'expo-image';
import { router } from 'expo-router';
import { CalendarDays, GitBranch, Info, Link2, MapPin, Pencil, Share2, Sparkles, UserCheck, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

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

/** Dégradé d'assombrissement : haut sombre (lisibilité), bas fondu dans la couleur de fond. */
function BannerShade({ background }: { background: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0.4" />
          <Stop offset="0.45" stopColor="#000" stopOpacity="0.05" />
          <Stop offset="1" stopColor={background} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#shade)" />
    </Svg>
  );
}

/**
 * En-tête immersif : bannière plein cadre, grand avatar centré qui la chevauche, statuts spéciaux,
 * statistiques en 3 colonnes, action principale, bio Markdown et réseaux sociaux.
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
      <Animated.View entering={FadeIn.duration(400)} style={[styles.banner, { backgroundColor: accent }]}>
        {banner ? <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" /> : null}
        <BannerShade background={colors.background} />
        <PressableScale
          scaleTo={0.9}
          accessibilityLabel={t('feed.share')}
          onPress={() => shareProfile(profile.username, name)}
          style={styles.share}
        >
          <Share2 size={17} color="#FFFFFF" />
        </PressableScale>
      </Animated.View>

      <View style={styles.body}>
        <Animated.View entering={ZoomIn.springify().damping(13).delay(120)} style={[styles.avatarRing, { backgroundColor: colors.background }]}>
          <Avatar name={name} src={profile.avatar_url} color={accent} size={120} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(360)} style={styles.identity}>
          <View style={styles.nameRow}>
            <Text variant="display" numberOfLines={2} style={styles.center}>
              {name}
            </Text>
            {special.map((badge) => {
              const { icon: Icon, color } = SPECIAL_BADGES[badge.code]!;
              return (
                <View key={badge.code} accessibilityLabel={badge.label} style={[styles.special, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                  <Icon size={15} color={color} />
                </View>
              );
            })}
          </View>
          <Text tone="muted" style={styles.center}>
            @{profile.username}
            {profile.stack?.length ? ` · ${profile.stack.slice(0, 3).join(', ')}` : ''}
          </Text>
        </Animated.View>

        <StatsBar profile={profile} accent={accent} />

        <View style={styles.action}>
          {isMe ? (
            <Button label={t('profile.edit_mine')} icon={Pencil} variant="secondary" block onPress={() => router.push('/edit-profile')} />
          ) : (
            <FollowButton profile={profile} />
          )}
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
      icon={following ? UserCheck : UserPlus}
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

/** [Abonnements] | [Abonnés] | [Craft Score] : les deux premiers ouvrent la liste, le 3e le détail. */
function StatsBar({ profile, accent }: { profile: PublicProfile; accent: string }) {
  const { colors } = useTheme();
  const [list, setList] = useState<'followers' | 'following' | null>(null);
  const [craftOpen, setCraftOpen] = useState(false);
  const cells = [
    { key: 'following', value: profile.following_count, label: t('profile.following_count'), onPress: () => setList('following') },
    { key: 'followers', value: profile.followers_count, label: t('profile.followers_count'), onPress: () => setList('followers') },
    { key: 'craft', value: profile.craft.score, label: t('profile.karma'), onPress: () => setCraftOpen(true) },
  ];
  return (
    <>
      <View style={styles.stats}>
        {cells.map((cell, index) => (
          <PressableScale
            key={cell.key}
            scaleTo={0.94}
            onPress={cell.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${formatCount(cell.value)} ${cell.label}`}
            style={[styles.stat, index ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line } : null]}
          >
            <View style={styles.inline}>
              {cell.key === 'craft' ? <Sparkles size={15} color={accent} /> : null}
              <Text variant="title" style={cell.key === 'craft' ? { color: accent } : null}>
                {formatCount(cell.value)}
              </Text>
            </View>
            <View style={styles.inline}>
              <Text variant="caption" tone="muted">
                {cell.label}
              </Text>
              {cell.key === 'craft' ? <Info size={11} color={colors.inkFaint} /> : null}
            </View>
          </PressableScale>
        ))}
      </View>
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
  return (
    <Sheet visible={kind !== null} onClose={onClose} title={t(kind === 'following' ? 'profile.following_count' : 'profile.followers_count')}>
      <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetBody}>
        {list.isPending ? (
          <ListFooter loading />
        ) : list.items.length ? (
          list.items.map((member) => (
            <PressableScale
              key={member.id}
              scaleTo={0.98}
              onPress={() => {
                onClose();
                router.push(`/u/${member.username}`);
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
  banner: { height: 190, overflow: 'hidden' },
  share: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  body: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 14, marginTop: -78 },
  avatarRing: { padding: 5, borderRadius: 70 },
  identity: { alignItems: 'center', gap: 4 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  special: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stats: { flexDirection: 'row', alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6 },
  action: { alignSelf: 'stretch', paddingHorizontal: 24 },
  bio: { alignSelf: 'stretch' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 6 },
  otw: { alignSelf: 'stretch' },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  sheetList: { maxHeight: 460 },
  split: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
