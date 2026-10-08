import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BarChart3, MessageSquare } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { absoluteUrl } from '@/shared/api';
import { useDataSaver } from '@/shared/data-saver';
import { useT } from '@/shared/i18n';
import { formatCount, plainText, timeAgo } from '@/shared/lib';
import { radius, useTheme } from '@/shared/theme';
import { Avatar, TagRow, Text } from '@/shared/ui';

import { imageOf, type Post } from './api';
import { VoteCapsule } from './VoteCapsule';

/** Ligne de communauté : « h/lome-dev » si le post est dans un hub, sinon l'auteur. */
export function PostByline({ post, showHub = true }: { post: Post; showHub?: boolean }) {
  const { t } = useT();
  const author = post.author;
  const name = author?.display_name || author?.username || t('member');
  return (
    <View style={styles.byline}>
      <Avatar name={name} src={author?.avatar_url} size={22} />
      <Text variant="caption" numberOfLines={1} style={styles.flex}>
        {showHub && post.hub ? (
          <Text variant="caption" style={styles.strong} onPress={() => router.push(`/h/${post.hub!.slug}`)}>
            h/{post.hub.slug}
            <Text variant="caption" tone="faint">
              {' · '}
            </Text>
          </Text>
        ) : null}
        <Text
          variant="caption"
          tone={showHub && post.hub ? 'muted' : 'ink'}
          style={showHub && post.hub ? null : styles.strong}
          onPress={author ? () => router.push(`/u/${author.username}`) : undefined}
        >
          {showHub && post.hub ? `@${author?.username ?? t('member')}` : name}
        </Text>
        <Text variant="caption" tone="faint">
          {` · ${timeAgo(post.created_at)}`}
        </Text>
      </Text>
    </View>
  );
}

export const PostRow = memo(function PostRow({ post, showHub = true }: { post: Post; showHub?: boolean }) {
  const { colors } = useTheme();
  const { textOnly } = useDataSaver();
  const { t, tp } = useT();
  const image = imageOf(post);
  const thumb = image && !textOnly ? absoluteUrl(image.urls.small ?? image.original_url) : undefined;
  const excerpt = plainText(post.body, 200);
  const open = () => router.push(`/post/${post.id}`);

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed && { backgroundColor: colors.pressed }]}
    >
      <PostByline post={post} showHub={showHub} />
      <View style={styles.content}>
        <View style={styles.flex}>
          {post.title ? (
            <Text variant="headline" numberOfLines={3}>
              {post.title}
            </Text>
          ) : null}
          {excerpt ? (
            <Text variant={post.title ? 'small' : 'body'} tone={post.title ? 'muted' : 'ink'} numberOfLines={post.title ? 3 : 5}>
              {excerpt}
            </Text>
          ) : null}
        </View>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={[styles.thumb, { backgroundColor: colors.container }]}
            contentFit="cover"
            transition={150}
            recyclingKey={post.id}
          />
        ) : null}
      </View>
      {post.kind === 'poll' ? (
        <View style={[styles.poll, { backgroundColor: colors.container }]}>
          <BarChart3 size={14} color={colors.inkMuted} />
          <Text variant="caption" tone="muted">
            {t('feed.poll_count', { count: post.poll_options.length })}
          </Text>
        </View>
      ) : null}
      <TagRow tags={post.tags} />
      <View style={styles.actions}>
        <VoteCapsule post={post} />
        <Pressable
          onPress={open}
          accessibilityLabel={tp('feed.comments', post.comment_count)}
          style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? colors.containerHigh : colors.container }]}
        >
          <MessageSquare size={16} color={colors.inkMuted} />
          <Text variant="smallStrong" tone="muted">
            {formatCount(post.comment_count)}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strong: { fontWeight: '700' },
  content: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1, gap: 4 },
  thumb: { width: 84, height: 84, borderRadius: radius.md },
  poll: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill },
});
