import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ThumbsUp, ExternalLink, Globe, MessageSquare, Share2 } from 'lucide-react-native';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import { TranslateBar } from '@/features/translation';
import { useDataSaver } from '@/shared/data-saver';
import { useT } from '@/shared/i18n';
import { domainOf, formatCount, openLink, timeAgo } from '@/shared/lib';
import { radius, useTheme } from '@/shared/theme';
import { Button, EmptyState, Header, IconButton, Markdown, TagRow, Text } from '@/shared/ui';

import { useNewsItem, type NewsItem } from './api';

export function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t, tp } = useT();
  const { textOnly } = useDataSaver();
  const item = useNewsItem(id);

  if (!item) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <Header back title={t('tab.news')} />
        <EmptyState
          icon={Globe}
          title={t('news.empty')}
          body={t('news.empty_body')}
        />
      </View>
    );
  }

  const domain = domainOf(item.url);
  const share = () => {
    void Share.share({
      title: item.title,
      url: item.url,
      message: `${item.title}\n${item.url}`,
    });
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        back
        title={item.source_name}
        right={<IconButton icon={Share2} label={t('feed.share')} onPress={share} />}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Métadonnées de l'article */}
        <View style={styles.metaRow}>
          <Text variant="caption" tone="muted">
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

        {/* Titre */}
        <Text variant="title" style={styles.title}>
          {item.title}
        </Text>

        {/* Image de couverture si disponible */}
        {item.image_url && !textOnly ? (
          <Image
            source={{ uri: item.image_url }}
            style={[styles.banner, { backgroundColor: colors.container }]}
            contentFit="cover"
            transition={200}
          />
        ) : null}

        {/* Traduction / Vulgarisation */}
        <TranslateBar text={[item.title, item.excerpt].filter(Boolean).join('\n\n')} />

        {/* Contenu / Résumé */}
        {item.excerpt ? (
          <View style={styles.body}>
            <Markdown source={item.excerpt} />
          </View>
        ) : null}

        {/* Tags */}
        {item.tags?.length ? (
          <View style={styles.tags}>
            <TagRow tags={item.tags} />
          </View>
        ) : null}

        {/* Barre d'action et interactions */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.statsRow}>
            {item.score !== null ? (
              <View style={styles.stat}>
                <ThumbsUp size={16} color={colors.primary} />
                <Text variant="smallStrong" tone="primary">
                  {tp('poll.votes', item.score)}
                </Text>
              </View>
            ) : null}

            {item.comment_count !== null ? (
              <View style={styles.stat}>
                <MessageSquare size={16} color={colors.inkMuted} />
                <Text variant="smallStrong" tone="muted">
                  {tp('feed.comments', item.comment_count)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Button
              icon={ExternalLink}
              label={t('news.open_source')}
              variant="primary"
              block
              onPress={() => void openLink(item.url)}
            />

            {item.discussion_url && item.discussion_url !== item.url ? (
              <Button
                icon={MessageSquare}
                label={t('news.view_discussion')}
                variant="secondary"
                block
                onPress={() => void openLink(item.discussion_url)}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, gap: 16, paddingBottom: 48 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 4 },
  banner: { width: '100%', height: 210, borderRadius: radius.md },
  body: { marginVertical: 4 },
  tags: { marginTop: 4 },
  card: { padding: 16, borderRadius: radius.md, borderWidth: 1, gap: 16, marginTop: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { gap: 10 },
});
