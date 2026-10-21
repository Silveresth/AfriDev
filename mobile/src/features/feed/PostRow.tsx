import { router } from 'expo-router';
import { BarChart3 } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionBar } from '@/features/engage';
import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { plainText, timeAgo } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { HubRoleBadge, PinnedBadge, ProfileAvatar, TagRow, Text, useToast } from '@/shared/ui';

import { imageOf, type Post, useDeletePost, useScoreVote, videoOf } from './api';
import { PostImage } from './PostImage';
import { PostVideo } from './PostVideo';
import { ResourceLink } from './ResourceLink';

/** Ligne de communauté : « h/lome-dev » si le post est dans un hub, sinon l'auteur. */
export function PostByline({ post, showHub = true }: { post: Post; showHub?: boolean }) {
  const { t } = useT();
  const author = post.author;
  const name = author?.display_name || author?.username || t('member');
  return (
    <View style={styles.byline}>
      <ProfileAvatar author={author} size={36} />
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
      <HubRoleBadge role={post.author_role} />
      {post.is_pinned ? <PinnedBadge /> : null}
    </View>
  );
}

export const PostRow = memo(function PostRow({ post, showHub = true }: { post: Post; showHub?: boolean }) {
  const { colors } = useTheme();
  const { t } = useT();
  const image = imageOf(post);
  const video = videoOf(post);
  const excerpt = plainText(post.body, 200);
  // Post « ressource » : la carte ouvre le post comme les autres ; sa bannière mène au lien.
  const open = () => router.push(`/post/${post.id}`);

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed && { backgroundColor: colors.pressed }]}
    >
      <PostByline post={post} showHub={showHub} />
      {post.title || excerpt ? (
        <View style={styles.content}>
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
      ) : null}
      {image ? <PostImage media={image} variant="feed" recyclingKey={post.id} /> : null}
      {post.link_url ? <ResourceLink url={post.link_url} preview={post.link_preview} /> : null}
      {video ? <PostVideo media={video} /> : null}
      {post.kind === 'poll' ? (
        <View style={[styles.poll, { backgroundColor: colors.container }]}>
          <BarChart3 size={14} color={colors.inkMuted} />
          <Text variant="caption" tone="muted">
            {t('feed.poll_count', { count: post.poll_options.length })}
          </Text>
        </View>
      ) : null}
      <TagRow tags={post.tags} />
      <PostActions post={post} />
    </Pressable>
  );
});

/** Actions d'un post depuis une liste : auteur et staff modifient ; modérateurs du hub suppriment. */
export function PostActions({ post }: { post: Post }) {
  const { t } = useT();
  const { user } = useSession();
  const toast = useToast();
  const vote = useScoreVote(post);
  const remove = useDeletePost();
  const mine = Boolean(user && post.author?.id === user.id);
  const canEdit = mine || Boolean(user?.is_staff);
  const canDelete = canEdit || Boolean(post.viewer?.can_moderate);
  return (
    <ActionBar
      vote={{ score: post.score, value: post.viewer?.post_vote ?? 0, onVote: (value) => vote.mutate(value) }}
      thread={{ kind: 'post', id: post.id, count: post.comment_count }}
      share={{ title: post.title || t('feed.share_default'), path: `/feed/${post.id}` }}
      save={{ type: 'post', id: post.id }}
      more={{
        report: mine ? undefined : { type: 'post', id: post.id },
        onEdit: canEdit ? () => router.push({ pathname: '/compose/post', params: { editId: post.id } }) : undefined,
        editLabel: t('modify.post'),
        onDelete: canDelete
          ? () => remove.mutate(post.id, { onSuccess: () => toast(t('mod.deleted')), onError: (error) => toast(errorMessage(error), 'error') })
          : undefined,
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strong: { fontWeight: '700' },
  content: { gap: 4 },
  flex: { flex: 1 },
  poll: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
});
