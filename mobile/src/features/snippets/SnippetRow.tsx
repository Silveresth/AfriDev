import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/shared/i18n';
import { languageColor, timeAgo } from '@/shared/lib';
import { PressableScale } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { CodeBlock, HubRoleBadge, TagRow, Text } from '@/shared/ui';

import type { PublicSnippet } from './api';

/** Snippet public : aperçu des premières lignes ; un toucher ouvre le snippet dans l'appli. */
export const SnippetRow = memo(function SnippetRow({ snippet }: { snippet: PublicSnippet }) {
  const { colors } = useTheme();
  const { t } = useT();
  const lines = snippet.content.split('\n');
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <PressableScale scaleTo={0.99} onPress={() => router.push(`/snippet/${snippet.id}`)} style={styles.gap}>
        <View style={styles.inline}>
          <View style={[styles.dot, { backgroundColor: languageColor(snippet.language) }]} />
          <Text variant="caption" tone="muted" style={styles.flex} numberOfLines={1}>
            {snippet.language} · @{snippet.author?.username ?? t('member')} · {timeAgo(snippet.published_at)}
          </Text>
          <HubRoleBadge role={snippet.author_role} />
        </View>
        <Text variant="bodyStrong">{snippet.title}</Text>
        <CodeBlock code={lines.slice(0, 6).join('\n')} />
        {lines.length > 6 ? (
          <Text variant="caption" tone="muted">
            {t('snippet.expand', { count: lines.length })}
          </Text>
        ) : null}
        <TagRow tags={snippet.tags} />
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  gap: { gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  flex: { flex: 1 },
});
