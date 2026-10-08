import { Image } from 'expo-image';
import { ArrowBigUp, MessageSquare } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useDataSaver } from '@/shared/data-saver';
import { useT } from '@/shared/i18n';
import { domainOf, formatCount, openLink, timeAgo } from '@/shared/lib';
import { radius, useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import type { NewsItem } from './api';

/** Pastille de la source : couleur unie, une lettre (aucun logo tiers embarqué). */
function SourceMark({ item }: { item: NewsItem }) {
  const { colors } = useTheme();
  const look =
    item.source === 'hackernews'
      ? { bg: '#FF6600', fg: '#FFFFFF', letter: 'Y' }
      : item.source === 'devto'
        ? { bg: colors.ink, fg: colors.background, letter: 'D' }
        : { bg: colors.container, fg: colors.inkMuted, letter: item.source_name.charAt(0).toUpperCase() };
  return (
    <View style={[styles.mark, { backgroundColor: look.bg }]}>
      <Text style={[styles.markLetter, { color: look.fg }]}>{look.letter}</Text>
    </View>
  );
}

export const NewsRow = memo(function NewsRow({ item }: { item: NewsItem }) {
  const { colors } = useTheme();
  const { t } = useT();
  const { textOnly } = useDataSaver();
  const domain = domainOf(item.url);
  const hasDiscussion = item.comment_count !== null && Boolean(item.discussion_url);

  return (
    <Pressable
      onPress={() => void openLink(item.url)}
      accessibilityRole="link"
      accessibilityHint={t('news.open_hint', { site: domain || item.source_name })}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed && { backgroundColor: colors.pressed }]}
    >
      <View style={styles.meta}>
        <SourceMark item={item} />
        <Text variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
          {item.source_name}
          {domain && item.source !== 'rss' ? ` · ${domain}` : ''}
          {item.published_at ? ` · ${timeAgo(item.published_at)}` : ''}
        </Text>
        {item.lang === 'fr' ? (
          <Text variant="caption" tone="faint">
            FR
          </Text>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={3}>
            {item.title}
          </Text>
          {item.excerpt ? (
            <Text variant="small" tone="muted" numberOfLines={2} style={styles.excerpt}>
              {item.excerpt}
            </Text>
          ) : null}
        </View>
        {item.image_url && !textOnly ? (
          <Image
            source={{ uri: item.image_url }}
            style={[styles.thumb, { backgroundColor: colors.container }]}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={item.id}
          />
        ) : null}
      </View>

      {item.score !== null || hasDiscussion ? (
        <View style={styles.stats}>
          {item.score !== null ? (
            <View style={styles.stat}>
              <ArrowBigUp size={16} color={colors.inkFaint} />
              <Text variant="caption" tone="faint">
                {formatCount(item.score)}
              </Text>
            </View>
          ) : null}
          {hasDiscussion ? (
            <Pressable
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={t('feed.comments.other', { count: item.comment_count ?? 0 })}
              onPress={() => void openLink(item.discussion_url)}
              style={styles.stat}
            >
              <MessageSquare size={14} color={colors.inkFaint} />
              <Text variant="caption" tone="faint">
                {formatCount(item.comment_count)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 14, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 18, height: 18, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  markLetter: { fontSize: 11, lineHeight: 13, fontWeight: '800' },
  body: { flexDirection: 'row', gap: 12 },
  excerpt: { marginTop: 4 },
  thumb: { width: 76, height: 76, borderRadius: radius.md },
  stats: { flexDirection: 'row', gap: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
});
