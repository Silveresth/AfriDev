import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, type TextInputSelectionChangeEventData } from 'react-native';

import { api, unwrap } from '@/shared/api';
import { haptic } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';

import { Avatar } from './Avatar';
import { Text } from './Text';

const TRIGGER = /(?:^|[^\w@/.])@([A-Za-z0-9_]{1,30})$/;
const SPLIT = /((?<![\w@/.])@[A-Za-z0-9_]{3,30}\b)/g;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * @mentions dans un champ : tapez « @ » puis le début d'un pseudo ou d'un nom ; un bandeau de
 * membres apparaît au-dessus du champ. Le membre choisi est notifié à la publication.
 */
export function useMentions(value: string, onChangeText: (value: string) => void) {
  const [caret, setCaret] = useState(value.length);
  const before = value.slice(0, caret);
  const match = before.match(TRIGGER);
  const query = match ? (match[1] ?? '') : null;
  const debounced = useDebounced(query ?? '', 150);
  const people = useQuery({
    queryKey: ['people-search', debounced],
    queryFn: () => unwrap(api.GET('/api/profiles/search/', { params: { query: { q: debounced, limit: 6 } } })),
    enabled: query !== null && debounced.length >= 1,
    staleTime: 60_000,
  });
  const options = query !== null ? (people.data ?? []).filter((person) => !person.is_me) : [];

  const pick = (username: string) => {
    haptic.select();
    const head = before.replace(/@([A-Za-z0-9_]{0,30})$/, `@${username} `);
    onChangeText(head + value.slice(caret));
    setCaret(head.length);
  };

  return {
    onSelectionChange: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => setCaret(event.nativeEvent.selection.end),
    onChangeText: (next: string) => {
      onChangeText(next);
      setCaret(next.length);
    },
    suggestions: options.length ? <MentionSuggestions people={options} onPick={pick} /> : null,
  };
}

function MentionSuggestions({
  people,
  onPick,
}: {
  people: { id: string; username: string; display_name: string; avatar_url?: string | null }[];
  onPick: (username: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      {people.map((person) => (
        <Pressable
          key={person.id}
          accessibilityRole="button"
          accessibilityLabel={`@${person.username}`}
          onPress={() => onPick(person.username)}
          style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? colors.pressed : colors.background, borderColor: colors.line }]}
        >
          <Avatar name={person.display_name} src={person.avatar_url} size={28} />
          <Text variant="smallStrong" numberOfLines={1} style={styles.name}>
            {person.display_name}
          </Text>
          <Text variant="caption" tone="faint" numberOfLines={1}>
            @{person.username}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Texte où chaque @pseudo s'affiche en couleur et ouvre le profil au toucher. */
export function MentionText({ text, variant = 'small', numberOfLines }: { text: string; variant?: 'small' | 'body'; numberOfLines?: number }) {
  const { colors } = useTheme();
  return (
    <Text variant={variant} numberOfLines={numberOfLines} selectable>
      {text.split(SPLIT).map((part, index) =>
        index % 2 ? (
          <Text key={index} variant={variant} style={{ color: colors.primary, fontWeight: '700' }} onPress={() => router.push(`/u/${part.slice(1)}`)}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  bar: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, maxHeight: 56 },
  row: { gap: 8, padding: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, paddingVertical: 4, paddingLeft: 4, paddingRight: 12 },
  name: { maxWidth: 120 },
});
