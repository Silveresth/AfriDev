import { router } from 'expo-router';
import {
  Award,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Code2,
  FolderGit2,
  GitBranch,
  Link2,
  MapPin,
  MessagesSquare,
  Newspaper,
  Pencil,
  Pin,
  Plus,
  QrCode,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
  UsersRound,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { SvgUri } from 'react-native-svg';

import { errorMessage, PUBLIC_WEB_URL } from '@/shared/api';
import { formatCount, languageColor, monthYear, openLink, profileColorHex } from '@/shared/lib';
import { t } from '@/shared/i18n';
import { haptic, PressableScale } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { Avatar, Button, Sheet, Tag, Text, useToast } from '@/shared/ui';

import {
  type MyProfile,
  type PinTargetType,
  type PublicProfile,
  qrCodeUrl,
  useAiBio,
  useEndorse,
  useEndorsements,
  useGitHubOverview,
  usePinCandidates,
  useSetPinned,
  useUpdateProfile,
  WORK_PREFERENCES,
  type WorkPreference,
} from './api';

const PIN_ICONS = { post: Newspaper, question: MessagesSquare, snippet: Code2, project: FolderGit2 };
const PIN_LABELS = { post: 'kind.post', question: 'kind.question', snippet: 'kind.snippet', project: 'kind.project' } as const;

export const shareProfile = (username: string, name: string) =>
  void Share.share({ message: t('profile.share_message', { name, url: `${PUBLIC_WEB_URL}/u/${username}` }) });

/** Carte encadrée commune aux sections du profil. */
export function Card({ children, index = 0, style }: { children: React.ReactNode; index?: number; style?: object }) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(80 + index * 60).duration(360)}
      style={[styles.card, { borderColor: colors.line, backgroundColor: colors.background }, style]}
    >
      {children}
    </Animated.View>
  );
}

function CardTitle({ icon: Icon, title, right }: { icon: typeof Award; title: string; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.cardTitle}>
      <Icon size={18} color={colors.inkFaint} />
      <Text variant="headline" style={styles.flex}>
        {title}
      </Text>
      {right}
    </View>
  );
}

// ── En-tête : bannière, avatar, identité, liens, Open to Work, chiffres clés ──

function PulseDot({ color }: { color: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 1.6 }] }));
  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, ring]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

export function OpenToWork({ profile }: { profile: PublicProfile }) {
  const { colors } = useTheme();
  if (!profile.open_to_work) return null;
  const preferences = profile.work_preferences.filter((code): code is WorkPreference => code in WORK_PREFERENCES);
  return (
    <View style={[styles.otw, { backgroundColor: colors.secondarySoft }]}>
      <View style={styles.inline}>
        <PulseDot color={colors.secondary} />
        <Text variant="smallStrong" tone="secondary">
          {t('profile.otw')}{profile.daily_rate ? ` · ${profile.daily_rate}` : ''}
        </Text>
      </View>
      {preferences.length ? (
        <View style={styles.wrap}>
          {preferences.map((code) => (
            <View key={code} style={[styles.pref, { backgroundColor: colors.background }]}>
              <BriefcaseBusiness size={12} color={colors.secondaryInk} />
              <Text variant="caption">{t(WORK_PREFERENCES[code])}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {profile.availability_note ? (
        <Text variant="small" tone="secondary">
          {profile.availability_note}
        </Text>
      ) : null}
    </View>
  );
}

export function ProfileHero({ profile, isMe }: { profile: PublicProfile; isMe: boolean }) {
  const { colors } = useTheme();
  const name = profile.display_name || profile.username;
  const accent = profileColorHex(profile.username, profile.accent_color);
  const stats = [
    { label: t('profile.karma'), value: profile.karma_score ?? 0, strong: true },
    { label: t('profile.upvotes'), value: profile.karma_details?.upvotes ?? 0 },
    { label: t('profile.accepted'), value: profile.karma_details?.accepted_answers ?? 0 },
    { label: t('profile.snippet_saves'), value: profile.karma_details?.snippet_saves ?? 0 },
  ];

  return (
    <View>
      <Animated.View entering={FadeIn.duration(400)} style={[styles.banner, { backgroundColor: accent }]} />
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Animated.View entering={ZoomIn.springify().damping(13).delay(120)} style={[styles.avatarRing, { backgroundColor: colors.background }]}>
            <Avatar name={name} src={profile.avatar_url} color={accent} size={92} />
          </Animated.View>
          <View style={styles.heroActions}>
            {isMe ? <Button label={t('common.edit')} icon={Pencil} variant="secondary" size="sm" onPress={() => router.push('/edit-profile')} /> : null}
            <Button label={t('feed.share')} icon={Share2} variant="secondary" size="sm" onPress={() => shareProfile(profile.username, name)} />
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(160).duration(360)} style={styles.identity}>
          <Text variant="display" numberOfLines={2}>
            {name}
          </Text>
          {profile.badges?.length ? (
            <View style={styles.wrap}>
              {profile.badges.slice(0, 2).map((badge) => (
                <Tag key={badge.code} label={badge.label} tone="primary" />
              ))}
            </View>
          ) : null}
          <Text tone="muted">
            @{profile.username}
            {profile.stack?.length ? `  /  ${t('profile.dev', { stack: profile.stack.slice(0, 3).join(', ') })}` : ''}
          </Text>
        </Animated.View>

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
          {profile.github_username ? (
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
        <OpenToWork profile={profile} />
      </View>

      <View style={[styles.stats, { borderColor: colors.line }]}>
        {stats.map((stat, index) => (
          <View
            key={stat.label}
            style={[
              styles.stat,
              { borderColor: colors.line },
              index % 2 ? { borderLeftWidth: StyleSheet.hairlineWidth } : null,
              index > 1 ? { borderTopWidth: StyleSheet.hairlineWidth } : null,
            ]}
          >
            <Text variant="caption" tone="faint">
              {stat.label}
            </Text>
            <Text variant="title" style={stat.strong ? { color: accent } : null}>
              {formatCount(Number(stat.value))}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Profil complété (moi uniquement) ──

export function CompletionCard({ profile }: { profile: MyProfile }) {
  const { colors } = useTheme();
  const steps = [
    { label: t('profile.step.name'), done: Boolean(profile.display_name) },
    { label: t('profile.step.bio'), done: Boolean(profile.bio) },
    { label: t('profile.step.stack'), done: profile.stack.length > 0 },
    { label: t('profile.step.location'), done: Boolean(profile.location) },
    { label: t('profile.step.github'), done: Boolean(profile.github_username) },
    { label: t('profile.step.pinned'), done: profile.pinned.length > 0 },
  ];
  const done = steps.filter((step) => step.done).length;
  const ratio = Math.round((done / steps.length) * 100);
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(300, withTiming(ratio, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [ratio, width]);
  const bar = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  if (done === steps.length) return null;

  return (
    <Card index={0}>
      <CardTitle
        icon={CheckCircle2}
        title={t('profile.completion')}
        right={
          <Text variant="bodyStrong" tone="secondary">
            {ratio} %
          </Text>
        }
      />
      <View style={[styles.track, { backgroundColor: colors.containerHigh }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.secondary }, bar]} />
      </View>
      <View style={styles.steps}>
        {steps.map((step) => (
          <View key={step.label} style={styles.inline}>
            {step.done ? <Check size={16} color={colors.secondaryInk} /> : <Circle size={16} color={colors.inkFaint} />}
            <Text variant="small" tone={step.done ? 'faint' : 'ink'} style={step.done ? styles.strike : null}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>
      <Button label={t('profile.complete')} icon={Pencil} variant="secondary" size="sm" block onPress={() => router.push('/edit-profile')} />
    </Card>
  );
}

// ── Épinglés ──

function PinSheet({ me, visible, onClose }: { me: MyProfile; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const candidates = usePinCandidates(me.id, visible);
  const setPinned = useSetPinned();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>(me.pinned.map((item) => `${item.target_type}:${item.target_id}`));

  const toggle = (key: string) => {
    haptic.select();
    setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : current.length >= 3 ? current : [...current, key]));
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('profile.step.pinned')}>
      <Text variant="small" tone="muted" style={styles.sheetHint}>
        {t('profile.pin_hint')}
      </Text>
      <View style={styles.sheetList}>
        {candidates.isPending ? (
          <Text variant="small" tone="muted" style={styles.sheetHint}>
            {t('common.loading')}
          </Text>
        ) : candidates.data?.length ? (
          candidates.data.slice(0, 12).map((item) => {
            const key = `${item.target_type}:${item.target_id}`;
            const position = selected.indexOf(key);
            const Icon = PIN_ICONS[item.target_type];
            return (
              <PressableScale
                key={key}
                scaleTo={0.98}
                disabled={position < 0 && selected.length >= 3}
                onPress={() => toggle(key)}
                style={[styles.pinOption, { opacity: position < 0 && selected.length >= 3 ? 0.45 : 1 }]}
              >
                <View
                  style={[
                    styles.pinCheck,
                    position >= 0 ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.lineStrong },
                  ]}
                >
                  {position >= 0 ? (
                    <Text variant="caption" tone="onPrimary" style={styles.bold}>
                      {position + 1}
                    </Text>
                  ) : null}
                </View>
                <Icon size={16} color={colors.inkFaint} />
                <Text variant="small" numberOfLines={1} style={styles.flex}>
                  {item.title}
                </Text>
                <Text variant="caption" tone="faint">
                  {t(PIN_LABELS[item.target_type])}
                </Text>
              </PressableScale>
            );
          })
        ) : (
          <Text variant="small" tone="muted" style={styles.sheetHint}>
            {t('profile.pin_none')}
          </Text>
        )}
      </View>
      <View style={styles.sheetActions}>
        <Button
          label={t('common.save')}
          block
          loading={setPinned.isPending}
          onPress={async () => {
            try {
              await setPinned.mutateAsync(
                selected.map((key) => {
                  const [target_type, target_id] = key.split(':') as [PinTargetType, string];
                  return { target_type, target_id };
                }),
              );
              toast(t('profile.pin_saved'));
              onClose();
            } catch (error) {
              toast(errorMessage(error), 'error');
            }
          }}
        />
      </View>
    </Sheet>
  );
}

function openPinned(type: PinTargetType, id: string, href: string) {
  if (type === 'post') router.push(`/post/${id}`);
  else if (type === 'question') router.push(`/question/${id}`);
  else void openLink(href.startsWith('http') ? href : `${PUBLIC_WEB_URL}${href}`);
}

export function PinnedSection({ profile, me }: { profile: PublicProfile; me?: MyProfile }) {
  const { colors } = useTheme();
  const [managing, setManaging] = useState(false);
  if (!profile.pinned.length && !me) return null;
  return (
    <Card index={1}>
      <CardTitle
        icon={Pin}
        title={t('profile.pinned')}
        right={me ? <Button label={t('profile.manage')} variant="ghost" size="sm" onPress={() => setManaging(true)} /> : null}
      />
      {profile.pinned.length ? (
        <View style={styles.gap}>
          {profile.pinned.map((item, index) => {
            const Icon = PIN_ICONS[item.target_type];
            return (
              <Animated.View key={`${item.target_type}-${item.target_id}`} entering={FadeInDown.delay(index * 70)}>
                <PressableScale
                  scaleTo={0.98}
                  onPress={() => openPinned(item.target_type, item.target_id, item.href)}
                  style={[styles.pinned, { borderColor: colors.line, backgroundColor: colors.surface }]}
                >
                  <View style={styles.inline}>
                    <Icon size={13} color={colors.inkFaint} />
                    <Text variant="caption" tone="faint">
                      {t(PIN_LABELS[item.target_type])}
                    </Text>
                    {item.language ? (
                      <>
                        <View style={[styles.langDot, { backgroundColor: languageColor(item.language) }]} />
                        <Text variant="caption" tone="faint">
                          {item.language}
                        </Text>
                      </>
                    ) : null}
                  </View>
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.excerpt ? (
                    <Text variant="small" tone="muted" numberOfLines={2}>
                      {item.excerpt}
                    </Text>
                  ) : null}
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      ) : (
        <PressableScale scaleTo={0.98} onPress={() => setManaging(true)} style={[styles.dashed, { borderColor: colors.lineStrong }]}>
          <Plus size={16} color={colors.inkMuted} />
          <Text variant="small" tone="muted" style={styles.flex}>
            {t('profile.pin_empty')}
          </Text>
        </PressableScale>
      )}
      {me ? <PinSheet me={me} visible={managing} onClose={() => setManaging(false)} /> : null}
    </Card>
  );
}

// ── À propos : bio, bio IA, compétences +1 ──

function AiBioSuggestion({ profile }: { profile: MyProfile }) {
  const { colors } = useTheme();
  const update = useUpdateProfile();
  const aiBio = useAiBio();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const suggestion = profile.ai_bio_suggestion;
  if (profile.ai_bio_status === 'failed') {
    return (
      <Text variant="small" tone="danger">
        {t('profile.ai_failed')}
      </Text>
    );
  }
  if (profile.ai_bio_status !== 'ready' || !suggestion || suggestion === profile.bio || dismissed === suggestion) return null;
  return (
    <Animated.View entering={FadeInDown} style={[styles.aiBox, { backgroundColor: colors.primarySoft }]}>
      <View style={styles.inline}>
        <Sparkles size={15} color={colors.primaryInk} />
        <Text variant="smallStrong" tone="primary">
          {t('profile.ai_suggestion')}
        </Text>
      </View>
      <Text>{suggestion}</Text>
      <View style={styles.wrap}>
        <Button label={t('profile.ai_use')} icon={Check} size="sm" loading={update.isPending} onPress={() => update.mutate({ bio: suggestion })} />
        <Button label={t('profile.ai_another')} icon={RefreshCw} variant="secondary" size="sm" loading={aiBio.isPending} onPress={() => aiBio.mutate()} />
        <Button label={t('profile.ai_ignore')} variant="ghost" size="sm" onPress={() => setDismissed(suggestion)} />
      </View>
    </Animated.View>
  );
}

function Endorsements({ profile, isMe }: { profile: PublicProfile; isMe: boolean }) {
  const { colors } = useTheme();
  const endorsements = useEndorsements(profile.username);
  const endorse = useEndorse(profile.username);
  const toast = useToast();
  const rows = endorsements.data ?? profile.stack.map((skill) => ({ skill, count: 0, endorsers: [], endorsed_by_me: false }));
  if (!rows.length) return null;

  return (
    <View style={[styles.endorse, { borderTopColor: colors.line }]}>
      <Text variant="smallStrong">{t('profile.skills')}</Text>
      <View style={styles.wrap}>
        {rows.map((row) => (
          <View
            key={row.skill}
            style={[
              styles.skill,
              row.endorsed_by_me ? { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft } : { borderColor: colors.line },
            ]}
          >
            <Text variant="smallStrong">{row.skill}</Text>
            {row.count ? (
              <Text variant="caption" tone="muted">
                {row.count}
              </Text>
            ) : null}
            {!isMe ? (
              <PressableScale
                scaleTo={0.85}
                disabled={endorse.isPending}
                accessibilityLabel={t(row.endorsed_by_me ? 'profile.unplus_one' : 'profile.plus_one', { skill: row.skill })}
                onPress={() => {
                  haptic.tap();
                  endorse.mutate({ skill: row.skill, endorse: !row.endorsed_by_me }, { onError: (error) => toast(errorMessage(error), 'error') });
                }}
                style={[styles.plusOne, { backgroundColor: row.endorsed_by_me ? colors.primary : colors.container }]}
              >
                <Text variant="caption" style={[styles.bold, { color: row.endorsed_by_me ? colors.onPrimary : colors.inkMuted }]}>
                  {row.endorsed_by_me ? '✓1' : '+1'}
                </Text>
              </PressableScale>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export function AboutSection({ profile, me }: { profile: PublicProfile; me?: MyProfile }) {
  const aiBio = useAiBio();
  return (
    <Card index={2}>
      <CardTitle
        icon={UsersRound}
        title={t('profile.about')}
        right={me ? <Button label={t('profile.ai_write')} icon={Sparkles} variant="ghost" size="sm" loading={aiBio.isPending} onPress={() => aiBio.mutate()} /> : null}
      />
      {profile.bio ? (
        <Text>{profile.bio}</Text>
      ) : (
        <Text tone="muted">{t(me ? 'profile.no_bio_me' : 'profile.no_bio')}</Text>
      )}
      {aiBio.isError ? (
        <Text variant="small" tone="danger">
          {errorMessage(aiBio.error)}
        </Text>
      ) : null}
      {me ? <AiBioSuggestion profile={me} /> : null}
      <Endorsements profile={profile} isMe={Boolean(me)} />
    </Card>
  );
}

// ── GitHub ──

export function GitHubSection({ profile }: { profile: PublicProfile }) {
  const { colors } = useTheme();
  const github = useGitHubOverview(profile.username, Boolean(profile.github_username));
  if (!profile.github_username || !github.data) return null;
  const data = github.data;
  const total = data.top_languages.reduce((sum, lang) => sum + lang.repos, 0) || 1;
  return (
    <Card index={3}>
      <CardTitle
        icon={GitBranch}
        title="GitHub"
        right={<Button label={`@${data.login}`} variant="ghost" size="sm" onPress={() => void openLink(data.html_url)} />}
      />
      <View style={styles.ghStats}>
        {[
          [t('profile.repos'), data.public_repos, FolderGit2],
          [t('profile.stars'), data.total_stars, Star],
          [t('profile.followers'), data.followers, UsersRound],
        ].map(([label, value, Icon]) => {
          const StatIcon = Icon as typeof Star;
          return (
            <View key={String(label)} style={[styles.ghStat, { borderColor: colors.line, backgroundColor: colors.surface }]}>
              <View style={styles.inline}>
                <StatIcon size={12} color={colors.inkFaint} />
                <Text variant="caption" tone="faint">
                  {String(label)}
                </Text>
              </View>
              <Text variant="headline">{formatCount(Number(value))}</Text>
            </View>
          );
        })}
      </View>
      {data.top_languages.length ? (
        <>
          <View style={styles.langBar}>
            {data.top_languages.map((lang) => (
              <View key={lang.name} style={{ flex: lang.repos, backgroundColor: languageColor(lang.name) }} />
            ))}
          </View>
          <View style={styles.wrap}>
            {data.top_languages.map((lang) => (
              <View key={lang.name} style={styles.inline}>
                <View style={[styles.langDot, { backgroundColor: languageColor(lang.name) }]} />
                <Text variant="caption">
                  {lang.name} <Text variant="caption" tone="faint">{Math.round((lang.repos / total) * 100)} %</Text>
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {data.top_repos.map((repo) => (
        <PressableScale
          key={repo.name}
          scaleTo={0.98}
          onPress={() => void openLink(repo.url)}
          style={[styles.repo, { borderColor: colors.line }]}
        >
          <View style={styles.inline}>
            <FolderGit2 size={14} color={colors.inkFaint} />
            <Text variant="smallStrong" numberOfLines={1} style={styles.flex}>
              {repo.name}
            </Text>
          </View>
          {repo.description ? (
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {repo.description}
            </Text>
          ) : null}
          <View style={styles.inline}>
            {repo.language ? (
              <>
                <View style={[styles.langDot, { backgroundColor: languageColor(repo.language) }]} />
                <Text variant="caption" tone="faint">
                  {repo.language}
                </Text>
              </>
            ) : null}
            <Star size={12} color={colors.inkFaint} />
            <Text variant="caption" tone="faint">
              {formatCount(repo.stars)}
            </Text>
          </View>
        </PressableScale>
      ))}
    </Card>
  );
}

// ── Badges ──

export function BadgesSection({ profile }: { profile: PublicProfile }) {
  const { colors } = useTheme();
  return (
    <Card index={4}>
      <CardTitle icon={Award} title={t('profile.badges')} />
      <Text variant="small" tone="muted">
        {t('profile.badges_desc')}
      </Text>
      {profile.badges?.length ? (
        profile.badges.map((badge) => (
          <View key={badge.code} style={[styles.badgeRow, { borderColor: colors.line, backgroundColor: colors.surface }]}>
            <View style={[styles.badgeIcon, { backgroundColor: colors.tertiarySoft }]}>
              <Award size={18} color={colors.tertiary} />
            </View>
            <View style={styles.flex}>
              <Text variant="smallStrong">{badge.label}</Text>
              <Text variant="caption" tone="muted">
                {badge.description}
              </Text>
            </View>
          </View>
        ))
      ) : (
        [
          [t('badge.python'), t('badge.python_rule')],
          [t('badge.major'), t('badge.major_rule')],
          [t('badge.top'), t('badge.top_rule')],
        ].map(([label, rule]) => (
          <View key={label} style={[styles.badgeRow, styles.dashedBorder, { borderColor: colors.lineStrong }]}>
            <Award size={16} color={colors.inkFaint} />
            <View style={styles.flex}>
              <Text variant="smallStrong" tone="muted">
                {label}
              </Text>
              <Text variant="caption" tone="faint">
                {rule}
              </Text>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

// ── Carte développeur (QR code) ──

export function QrCard({ profile }: { profile: PublicProfile }) {
  const name = profile.display_name || profile.username;
  return (
    <Card index={5}>
      <CardTitle icon={QrCode} title={t('profile.qr')} />
      <Text variant="small" tone="muted">
        {t('profile.qr_desc')}
      </Text>
      <View style={styles.qr}>
        <SvgUri uri={qrCodeUrl(profile.username)} width={170} height={170} />
      </View>
      <Text variant="caption" tone="faint" style={styles.center}>
        afridev/u/{profile.username}
      </Text>
      <Button label={t('profile.share_mine')} icon={Share2} variant="secondary" size="sm" block onPress={() => shareProfile(profile.username, name)} />
    </Card>
  );
}

export function useIsMe(profile: PublicProfile | undefined) {
  const { profile: me } = useSession();
  return Boolean(me && profile && me.username.toLowerCase() === profile.username.toLowerCase());
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  center: { textAlign: 'center' },
  strike: { textDecorationLine: 'line-through' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gap: { gap: 10 },
  card: { marginHorizontal: 16, padding: 16, gap: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  banner: { height: 112 },
  hero: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -46 },
  avatarRing: { padding: 4, borderRadius: 54 },
  heroActions: { flexDirection: 'row', gap: 8 },
  identity: { gap: 6 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  otw: { padding: 12, borderRadius: radius.md, gap: 8 },
  pref: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  dotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  stat: { width: '50%', paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  steps: { gap: 6 },
  pinned: { padding: 14, gap: 6, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  dashed: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed' },
  dashedBorder: { borderStyle: 'dashed', borderWidth: 1.5 },
  langDot: { width: 8, height: 8, borderRadius: 4 },
  sheetHint: { paddingHorizontal: 20, paddingBottom: 6 },
  sheetList: { paddingHorizontal: 8, maxHeight: 360 },
  sheetActions: { paddingHorizontal: 20, paddingTop: 12 },
  pinOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  pinCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  aiBox: { padding: 12, gap: 10, borderRadius: radius.md },
  endorse: { gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  skill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingLeft: 12, paddingRight: 4, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  plusOne: { height: 24, minWidth: 30, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ghStats: { flexDirection: 'row', gap: 8 },
  ghStat: { flex: 1, padding: 10, gap: 2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  langBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  repo: { padding: 12, gap: 4, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  badgeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qr: { alignSelf: 'center', padding: 10, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
});
