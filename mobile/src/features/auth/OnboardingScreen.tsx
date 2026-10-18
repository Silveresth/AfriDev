import { computeFeedMix } from '@afridev/validation';
import { router } from 'expo-router';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  Cloud,
  Code2,
  Compass,
  Crown,
  Database,
  FolderGit2,
  GitBranch,
  GraduationCap,
  HandHelping,
  Lightbulb,
  type LucideIcon,
  Newspaper,
  Palette,
  Plus,
  Rocket,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Sprout,
  Store,
  Wallet,
  WifiOff,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInRight, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useJoinHub } from '@/features/hubs/api';
import { useFollow } from '@/features/profile/api';
import { errorMessage } from '@/shared/api';
import { type Key, useT } from '@/shared/i18n';
import { formatCount } from '@/shared/lib';
import { haptic, PressableScale } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Avatar, Button, Loading, Text } from '@/shared/ui';

import { type Onboarding, type Preferences, type Suggestions, useOnboarding, useSavePreferences, useSkipOnboarding, useSuggestions } from './onboarding';

const ICONS: Record<string, LucideIcon> = {
  student: GraduationCap,
  junior: Sprout,
  mid: Code2,
  senior: Rocket,
  founder: Crown,
  learn: BookOpen,
  help: HandHelping,
  job: Briefcase,
  hire: Search,
  collab: FolderGit2,
  share: Lightbulb,
  watch: Newspaper,
  web: Compass,
  backend: Database,
  mobile: Smartphone,
  devops: Cloud,
  data_ai: Sparkles,
  fintech: Wallet,
  offline: WifiOff,
  security: Shield,
  opensource: FolderGit2,
  career: Briefcase,
  startup: Store,
  design: Palette,
};
const MIX_COLORS: Record<string, string> = {
  post: '#C84B20',
  question: '#15803D',
  snippet: '#0284C7',
  project: '#7C3AED',
  job: '#D97706',
  event: '#DB2777',
  news: '#71717A',
  video: '#E11D48',
};
const TOTAL = 5;

interface Draft {
  experience_level: string;
  goals: string[];
  topics: string[];
  stack: string[];
  learning: string[];
}

/** Accueil en 5 étapes, ouvert une fois par compte (même parcours et même catalogue que le web). */
export function OnboardingScreen() {
  const onboarding = useOnboarding();
  const { colors } = useTheme();
  if (!onboarding.data) return <View style={[styles.flex, { backgroundColor: colors.background }]}>{onboarding.isError ? null : <Loading />}</View>;
  return <Wizard catalogue={onboarding.data} />;
}

function Wizard({ catalogue }: { catalogue: Onboarding }) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => ({ ...catalogue.current }));
  const save = useSavePreferences();
  const skip = useSkipOnboarding();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/feed'));

  const toggle = (key: 'goals' | 'topics', id: string) => {
    haptic.select();
    setDraft((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((v) => v !== id) : [...current[key], id] }));
  };
  const canNext = [Boolean(draft.experience_level), draft.goals.length > 0, draft.topics.length > 0, draft.stack.length + draft.learning.length > 0, true][step];

  const next = async () => {
    if (step === 3) {
      try {
        await save.mutateAsync(draft as Preferences);
      } catch {
        return;
      }
    }
    haptic.tap();
    if (step === TOTAL - 1) close();
    else setStep(step + 1);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text variant="caption" tone="primary" style={styles.caps}>
            {t('onb.step', { current: step + 1, total: TOTAL })}
          </Text>
          {step < 4 ? <Button label={t('onb.later')} variant="ghost" size="sm" loading={skip.isPending} onPress={() => skip.mutate(undefined, { onSettled: close })} /> : null}
        </View>
        <View style={styles.progress}>
          {Array.from({ length: TOTAL }, (_, index) => (
            <View key={index} style={[styles.progressBar, { backgroundColor: index <= step ? colors.primary : colors.containerHigh }]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} entering={FadeInRight.duration(260)} style={styles.gap}>
          {step === 0 ? (
            <Step title={t('onb.level_title', { name: profile?.display_name || profile?.username || '' })} subtitle={t('onb.level_sub')}>
              <Choices items={catalogue.levels} selected={[draft.experience_level]} onPress={(id) => setDraft({ ...draft, experience_level: id })} />
            </Step>
          ) : null}
          {step === 1 ? (
            <Step title={t('onb.goals_title')} subtitle={t('onb.goals_sub')}>
              <Choices items={catalogue.goals} selected={draft.goals} onPress={(id) => toggle('goals', id)} />
              <FeedPreview catalogue={catalogue} draft={draft} />
            </Step>
          ) : null}
          {step === 2 ? (
            <Step title={t('onb.topics_title')} subtitle={t('onb.topics_sub')}>
              <Choices items={catalogue.topics} selected={draft.topics} onPress={(id) => toggle('topics', id)} columns />
            </Step>
          ) : null}
          {step === 3 ? <StackStep catalogue={catalogue} draft={draft} onChange={setDraft} /> : null}
          {step === 4 ? <CommunityStep tags={[...draft.stack, ...draft.learning]} /> : null}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.line, paddingBottom: insets.bottom + 12 }]}>
        {save.isError ? (
          <Text variant="small" tone="danger">
            {errorMessage(save.error)}
          </Text>
        ) : null}
        <View style={styles.footerRow}>
          {step > 0 && step < 4 ? <Button label={t('onb.back')} variant="ghost" onPress={() => setStep(step - 1)} /> : <View />}
          <Button
            label={t(step === 4 ? 'onb.finish' : step === 3 ? 'onb.save' : 'onb.next')}
            icon={step === 4 ? Sparkles : ArrowRight}
            disabled={!canNext}
            loading={save.isPending}
            onPress={() => void next()}
          />
        </View>
      </View>
    </View>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.gap}>
      <Text variant="title">{title}</Text>
      <Text tone="muted">{subtitle}</Text>
      <View style={styles.gap}>{children}</View>
    </View>
  );
}

function Choices({ items, selected, onPress, columns = false }: { items: { id: string; label: string }[]; selected: string[]; onPress: (id: string) => void; columns?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={columns ? styles.grid : styles.gapSm}>
      {items.map((item) => {
        const active = selected.includes(item.id);
        const Icon = ICONS[item.id] ?? Sparkles;
        return (
          <PressableScale
            key={item.id}
            scaleTo={0.97}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            onPress={() => onPress(item.id)}
            style={[
              styles.choice,
              columns ? styles.choiceHalf : null,
              { borderColor: active ? colors.primary : colors.line, backgroundColor: active ? colors.primarySoft : colors.background },
            ]}
          >
            <View style={[styles.choiceIcon, { backgroundColor: active ? colors.primary : colors.container }]}>
              <Icon size={18} color={active ? colors.onPrimary : colors.inkMuted} />
            </View>
            <Text variant="smallStrong" style={styles.flex} numberOfLines={2}>
              {item.label}
            </Text>
            {active && !columns ? <Check size={16} color={colors.primaryInk} /> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Composition du fil recalculée à chaque objectif (même règle que le serveur). */
function FeedPreview({ catalogue, draft }: { catalogue: Onboarding; draft: Draft }) {
  const { colors } = useTheme();
  const { t } = useT();
  const mix = Object.entries(computeFeedMix(catalogue, draft.goals, draft.experience_level));
  return (
    <Animated.View layout={LinearTransition} style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.previewTitle}>
        <Sparkles size={14} color={colors.primary} />
        <Text variant="smallStrong">{t('onb.preview')}</Text>
      </View>
      <View style={styles.mixBar}>
        {mix.map(([kind, share]) => (
          <Animated.View key={kind} layout={LinearTransition} style={{ flex: share, backgroundColor: MIX_COLORS[kind] ?? colors.inkFaint }} />
        ))}
      </View>
      <View style={styles.legend}>
        {mix.slice(0, 6).map(([kind, share]) => (
          <View key={kind} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: MIX_COLORS[kind] ?? colors.inkFaint }]} />
            <Text variant="caption" tone="muted">
              {t(`mix.${kind}` as Key)} {share} %
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function StackStep({ catalogue, draft, onChange }: { catalogue: Onboarding; draft: Draft; onChange: (draft: Draft) => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const [target, setTarget] = useState<'stack' | 'learning'>('stack');
  const [input, setInput] = useState('');
  const suggestions = useMemo(() => {
    const fromTopics = catalogue.topics.filter((topic) => draft.topics.includes(topic.id)).flatMap((topic) => topic.suggest);
    return [...new Set([...catalogue.github_stack, ...fromTopics])].filter((tag) => !draft.stack.includes(tag) && !draft.learning.includes(tag));
  }, [catalogue, draft]);
  const github = catalogue.github_stack.filter((tag) => !draft.stack.includes(tag));

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || draft.stack.includes(tag) || draft.learning.includes(tag) || draft[target].length >= 20) return;
    haptic.select();
    onChange({ ...draft, [target]: [...draft[target], tag] });
  };

  return (
    <Step title={t('onb.stack_title')} subtitle={t('onb.stack_sub')}>
      {github.length ? (
        <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.inline}>
            <GitBranch size={15} color={colors.ink} />
            <Text variant="small" style={styles.flex}>
              {t('onb.github_found', { tags: github.join(', ') })}
            </Text>
          </View>
          <Button label={t('onb.import')} size="sm" variant="secondary" onPress={() => onChange({ ...draft, stack: [...new Set([...draft.stack, ...github])].slice(0, 20) })} />
        </View>
      ) : null}
      {(['stack', 'learning'] as const).map((where) => {
        const active = target === where;
        return (
          <PressableScale
            key={where}
            scaleTo={0.99}
            onPress={() => setTarget(where)}
            style={[styles.bucket, { borderColor: active ? colors.primary : colors.line, backgroundColor: active ? colors.primarySoft : colors.background }]}
          >
            <Text variant="smallStrong">
              {t(where === 'stack' ? 'onb.known' : 'onb.learning')} <Text variant="caption" tone="faint">{draft[where].length} / 20</Text>
            </Text>
            <View style={styles.wrap}>
              {draft[where].map((tag) => (
                <PressableScale
                  key={tag}
                  scaleTo={0.9}
                  onPress={() => onChange({ ...draft, [where]: draft[where].filter((v) => v !== tag) })}
                  style={[styles.tag, { backgroundColor: where === 'stack' ? colors.primary : colors.secondarySoft }]}
                >
                  <Text variant="caption" style={{ color: where === 'stack' ? colors.onPrimary : colors.secondaryInk, fontWeight: '700' }}>
                    {tag} ×
                  </Text>
                </PressableScale>
              ))}
            </View>
          </PressableScale>
        );
      })}
      <View style={[styles.input, { borderColor: colors.lineStrong, backgroundColor: colors.surface }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => {
            add(input);
            setInput('');
          }}
          placeholder={t('onb.add_ph')}
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit={false}
          style={[typography.body, styles.flex, { color: colors.ink }]}
        />
        <PressableScale
          scaleTo={0.85}
          onPress={() => {
            add(input);
            setInput('');
          }}
          style={[styles.addBtn, { backgroundColor: input.trim() ? colors.primary : colors.container }]}
        >
          <Plus size={16} color={input.trim() ? colors.onPrimary : colors.inkFaint} />
        </PressableScale>
      </View>
      <View style={styles.wrap}>
        {suggestions.slice(0, 24).map((tag) => (
          <PressableScale key={tag} scaleTo={0.92} onPress={() => add(tag)} style={[styles.suggestion, { borderColor: colors.line }]}>
            <Text variant="caption" tone="muted">
              + {tag}
            </Text>
          </PressableScale>
        ))}
      </View>
    </Step>
  );
}

function CommunityStep({ tags }: { tags: string[] }) {
  const { t } = useT();
  const suggestions = useSuggestions(tags);
  return (
    <Step title={t('onb.community_title')} subtitle={t('onb.community_sub')}>
      {suggestions.isPending ? <Loading /> : <CommunityLists data={suggestions.data} />}
    </Step>
  );
}

function CommunityLists({ data }: { data?: Suggestions }) {
  const { t } = useT();
  if (!data || (!data.people.length && !data.hubs.length)) return <Text tone="muted">{t('onb.empty')}</Text>;
  return (
    <View style={styles.gap}>
      {data.people.length ? <Text variant="smallStrong">{t('onb.people')}</Text> : null}
      {data.people.map((person) => (
        <PersonRow key={person.id} person={person} />
      ))}
      {data.hubs.length ? <Text variant="smallStrong">{t('onb.hubs')}</Text> : null}
      {data.hubs.map((hub) => (
        <HubRow key={hub.id} hub={hub} />
      ))}
    </View>
  );
}

function PersonRow({ person }: { person: Suggestions['people'][number] }) {
  const { colors } = useTheme();
  const { t } = useT();
  const follow = useFollow(person.username);
  const [followed, setFollowed] = useState(false);
  return (
    <View style={[styles.row, { borderColor: colors.line }]}>
      <Avatar name={person.display_name} src={person.avatar_url} size={42} />
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {person.display_name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {person.shared_stack.length ? t('onb.in_common', { tags: person.shared_stack.join(', ') }) : `${formatCount(person.craft_score)} Craft`}
        </Text>
      </View>
      <Button
        label={t(followed ? 'profile.following_state' : 'profile.follow')}
        size="sm"
        variant={followed ? 'secondary' : 'primary'}
        loading={follow.isPending}
        onPress={() => follow.mutate(!followed, { onSuccess: (state) => setFollowed(state.is_following) })}
      />
    </View>
  );
}

function HubRow({ hub }: { hub: Suggestions['hubs'][number] }) {
  const { colors } = useTheme();
  const { t } = useT();
  const join = useJoinHub(hub.slug);
  const [joined, setJoined] = useState(false);
  return (
    <View style={[styles.row, { borderColor: colors.line }]}>
      <View style={[styles.hubIcon, { backgroundColor: colors.container }]}>
        <Text variant="smallStrong">{hub.icon && !hub.icon.startsWith('http') ? hub.icon : hub.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          h/{hub.slug}
        </Text>
        <Text variant="caption" tone="muted">
          {t('onb.members', { count: formatCount(hub.member_count) })}
        </Text>
      </View>
      <Button
        label={t(joined ? 'onb.joined' : 'onb.join')}
        size="sm"
        variant="secondary"
        loading={join.isPending}
        onPress={() => join.mutate(!joined, { onSuccess: () => setJoined(!joined) })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  caps: { letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '700' },
  header: { paddingHorizontal: 20, gap: 10, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  progress: { flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 5, borderRadius: 3 },
  body: { padding: 20, paddingBottom: 40 },
  gap: { gap: 14 },
  gapSm: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1.5 },
  choiceHalf: { width: '48%' },
  choiceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  preview: { gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  previewTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mixBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bucket: { gap: 10, padding: 14, minHeight: 84, borderRadius: radius.lg, borderWidth: 1.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingLeft: 14, paddingRight: 6, borderRadius: radius.md, borderWidth: 1.5 },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  suggestion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  hubIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
