import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, BriefcaseBusiness, Code2, FolderGit2, MessagesSquare, Mic, Search, Square, UserRound, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVoiceRecorder } from '@/features/messaging/media';
import { useFollow } from '@/features/profile/api';
import { api, errorMessage, type Schemas, unwrap } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { formatCount, openLink } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { useRequireAuth } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Avatar, Button, EmptyState, IconButton, Text, useToast } from '@/shared/ui';

import { useVoiceSearch } from './voice';

type Tab = 'people' | 'content';
type Person = Schemas['PeopleSearchItem'];
type Hit = Schemas['SearchHit'];

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const SOURCE_ICON = { snippet: Code2, question: MessagesSquare, project: FolderGit2 } as const;

/** Explorer : comptes (comme TikTok / X) et contenus ; recherche au clavier ou à la voix. */
export function SearchScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [tab, setTab] = useState<Tab>('people');
  const q = useDebounced(text.trim(), 250);
  const voice = useVoiceSearch({
    onResult: (result) => {
      setText(result.query);
      if (result.scope === 'people') setTab('people');
      else if (result.scope === 'jobs') {
        void openLink(`/jobs?${new URLSearchParams({ ...(result.query ? { q: result.query } : {}), ...result.filters })}`);
      } else setTab('content');
    },
  });

  const people = useQuery({
    queryKey: ['people-search', q, 30],
    queryFn: () => unwrap(api.GET('/api/profiles/search/', { params: { query: { q, limit: 30 } } })),
    enabled: tab === 'people' && q.length >= 1,
  });
  const content = useQuery({
    queryKey: ['search', q, 'all', 'text'],
    queryFn: () => unwrap(api.GET('/api/knowledge/search/', { params: { query: { q, mode: 'text' } } })),
    enabled: tab === 'content' && q.length >= 2,
  });

  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.top}>
        <IconButton icon={ArrowLeft} label={t('header.back')} onPress={() => router.back()} />
        <View style={[styles.field, { backgroundColor: colors.container }]}>
          <Search size={18} color={colors.inkFaint} />
          <TextInput
            ref={input}
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder={t(tab === 'people' ? 'search.people_ph' : 'search.content_ph')}
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.primary}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={[typography.body, styles.input, { color: colors.ink }]}
          />
          {text ? (
            <Pressable hitSlop={8} onPress={() => setText('')} accessibilityLabel={t('header.close')}>
              <X size={16} color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(voice.recording ? 'search.voice_stop' : 'search.voice')}
          onPress={() => void (voice.recording ? voice.stop() : voice.start())}
          disabled={voice.busy}
          style={[styles.mic, { backgroundColor: voice.recording ? colors.danger : colors.primary }]}
        >
          {voice.busy ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : voice.recording ? (
            <Square size={16} color={colors.onPrimary} fill={colors.onPrimary} />
          ) : (
            <Mic size={18} color={colors.onPrimary} />
          )}
        </Pressable>
      </View>
      {voice.recording || voice.busy || voice.error ? (
        <Text variant="caption" tone={voice.error ? 'danger' : 'muted'} style={styles.voiceHint}>
          {voice.error ?? t(voice.recording ? 'search.listening' : 'search.understanding')}
        </Text>
      ) : null}

      <View style={[styles.tabs, { borderBottomColor: colors.line }]}>
        {(['people', 'content'] as const).map((value) => {
          const active = value === tab;
          return (
            <Pressable
              key={value}
              onPress={() => {
                haptic.select();
                setTab(value);
              }}
              style={[styles.tab, { borderBottomColor: active ? colors.primary : 'transparent' }]}
            >
              <Text variant="smallStrong" tone={active ? 'ink' : 'muted'}>
                {t(value === 'people' ? 'search.tab_people' : 'search.tab_content')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'people' ? (
        <FlatList
          data={q ? (people.data ?? []) : []}
          keyExtractor={(person) => person.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <PersonRow person={item} />}
          ListEmptyComponent={
            !q ? (
              <EmptyState icon={UserRound} title={t('search.people_title')} body={t('search.people_body')} />
            ) : people.isPending ? (
              <ActivityIndicator color={colors.primary} style={styles.loading} />
            ) : (
              <EmptyState icon={UserRound} title={t('search.no_people')} body={t('search.no_people_body', { q })} />
            )
          }
          contentContainerStyle={styles.grow}
        />
      ) : (
        <FlatList
          data={q.length >= 2 ? (content.data ?? []) : []}
          keyExtractor={(hit) => `${hit.source_type}-${hit.source_id}`}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <HitRow hit={item} />}
          ListEmptyComponent={
            q.length < 2 ? (
              <EmptyState icon={Search} title={t('search.content_title')} body={t('search.content_body')} />
            ) : content.isPending ? (
              <ActivityIndicator color={colors.primary} style={styles.loading} />
            ) : (
              <EmptyState icon={Search} title={t('search.no_results')} />
            )
          }
          contentContainerStyle={styles.grow}
        />
      )}
    </View>
  );
}

function PersonRow({ person }: { person: Person }) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const follow = useFollow(person.username);
  return (
    <Pressable onPress={() => router.push(`/u/${person.username}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressed }]}>
      <Avatar name={person.display_name} src={person.avatar_url} size={54} />
      <View style={styles.flex}>
        <View style={styles.inline}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
            {person.display_name}
          </Text>
          {person.open_to_work ? <BriefcaseBusiness size={13} color={colors.secondaryInk} /> : null}
        </View>
        <Text variant="small" tone="muted" numberOfLines={1}>
          @{person.username} · {t('search.followers', { count: formatCount(person.followers_count) })}
        </Text>
        {person.bio ? (
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {person.bio}
          </Text>
        ) : null}
      </View>
      {person.is_me ? null : (
        <Button
          label={t(person.is_following ? 'search.following' : 'profile.follow')}
          size="sm"
          variant={person.is_following ? 'secondary' : 'primary'}
          loading={follow.isPending}
          onPress={() =>
            requireAuth(() =>
              follow.mutate(!person.is_following, {
                onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['people-search'] }),
                onError: (error) => toast(errorMessage(error), 'error'),
              }),
            )
          }
        />
      )}
    </Pressable>
  );
}

function HitRow({ hit }: { hit: Hit }) {
  const { colors } = useTheme();
  const Icon = SOURCE_ICON[hit.source_type] ?? Search;
  return (
    <Pressable onPress={() => void openLink(hit.url)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressed }]}>
      <View style={[styles.hitIcon, { backgroundColor: colors.container }]}>
        <Icon size={18} color={colors.inkMuted} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {hit.title}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={2}>
          {hit.excerpt}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  grow: { flexGrow: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 8 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 22, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 0 },
  mic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  voiceHint: { paddingHorizontal: 16, paddingBottom: 6 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  hitIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  loading: { padding: 32 },
});
