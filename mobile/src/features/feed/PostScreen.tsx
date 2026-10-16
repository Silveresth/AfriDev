import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ImageIcon, MessageSquare, Pin, PinOff, Share2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, Share, StyleSheet, View } from 'react-native';

import { MoreButton } from '@/features/engage';
import { absoluteUrl, errorMessage, PUBLIC_WEB_URL } from '@/shared/api';
import { TranslateBar } from '@/features/translation';
import { useDataSaver } from '@/shared/data-saver';
import { useT } from '@/shared/i18n';
import { formatCount } from '@/shared/lib';
import { AppearItem } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { EmptyState, ErrorState, Header, IconButton, ListFooter, Loading, Markdown, TagRow, Text, useToast } from '@/shared/ui';

import { type Comment, imageOf, type Post, useComments, useDeletePost, usePinPost, usePost } from './api';
import { CommentComposer, CommentRow, threadRows } from './Comments';
import { Poll } from './Poll';
import { PostByline } from './PostRow';
import { VoteCapsule } from './VoteCapsule';

function PostBody({ post }: { post: Post }) {
  const { colors } = useTheme();
  const { textOnly } = useDataSaver();
  const [revealed, setRevealed] = useState(false);
  const { t, tp } = useT();
  const image = imageOf(post);
  const uri = image ? absoluteUrl(image.urls.large ?? image.original_url) : undefined;
  const ratio = image?.width && image.height ? image.width / image.height : 16 / 9;
  const hidden = textOnly && !revealed;

  return (
    <View style={[styles.post, { borderBottomColor: colors.line }]}>
      <PostByline post={post} />
      {post.title ? <Text variant="title">{post.title}</Text> : null}
      {post.body ? <Markdown source={post.body} /> : null}
      <TranslateBar text={[post.title, post.body].filter(Boolean).join('\n\n')} />
      {uri && hidden ? (
        <Pressable
          onPress={() => setRevealed(true)}
          style={[styles.image, styles.hiddenImage, { aspectRatio: ratio, backgroundColor: colors.container }]}
        >
          <ImageIcon size={18} color={colors.inkMuted} />
          <Text variant="small" tone="muted">
            {t('feed.image_hidden')}
          </Text>
        </Pressable>
      ) : uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { aspectRatio: ratio, backgroundColor: colors.container }]}
          contentFit="cover"
          transition={200}
        />
      ) : null}
      {post.kind === 'poll' ? <Poll post={post} /> : null}
      <TagRow tags={post.tags} max={5} />
      <View style={styles.actions}>
        <VoteCapsule post={post} />
        <View style={[styles.pill, { backgroundColor: colors.container }]}>
          <MessageSquare size={16} color={colors.inkMuted} />
          <Text variant="smallStrong" tone="muted">
            {formatCount(post.comment_count)}
          </Text>
        </View>
      </View>
      <Text variant="smallStrong" tone="muted" style={styles.section}>
        {post.comment_count ? tp('feed.comments', post.comment_count) : t('feed.comments_title')}
      </Text>
    </View>
  );
}

export function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useSession();
  const post = usePost(id);
  const comments = useComments(id);
  const remove = useDeletePost();
  const { t: tr } = useT();
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const rows = useMemo(() => threadRows(comments.items), [comments.items]);

  const isMine = Boolean(user && post.data?.author?.id === user.id);
  // Modérateur du hub (ou staff) : épingler, supprimer le post d'un autre membre.
  const moderator = Boolean(post.data?.viewer?.can_moderate);
  const pin = usePinPost();
  const toast = useToast();

  const share = () => {
    if (!post.data) return;
    void Share.share({ message: `${post.data.title || tr('feed.share_default')} — ${PUBLIC_WEB_URL}/feed/${post.data.id}` });
  };

  const togglePin = () => {
    if (!post.data) return;
    pin.mutate(
      { id: post.data.id, pinned: !post.data.is_pinned },
      {
        onSuccess: (updated) => toast(tr(updated.is_pinned ? 'mod.pinned_toast' : 'mod.unpinned_toast')),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    );
  };

  const canEdit = isMine || Boolean(user?.is_staff);

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={post.data?.hub ? `h/${post.data.hub.slug}` : tr('feed.post')}
        back
        right={
          <>
            <IconButton icon={Share2} label={tr('feed.share')} onPress={share} />
            {moderator && post.data?.hub ? (
              <IconButton
                icon={post.data.is_pinned ? PinOff : Pin}
                label={tr(post.data.is_pinned ? 'mod.unpin' : 'mod.pin')}
                onPress={togglePin}
              />
            ) : null}
            <MoreButton
              report={isMine || !post.data ? undefined : { type: 'post', id }}
              onEdit={canEdit ? () => router.push({ pathname: '/compose/post', params: { editId: id } }) : undefined}
              editLabel={tr('modify.post')}
              onDelete={
                canEdit || moderator
                  ? () => remove.mutate(id, { onSuccess: () => router.back(), onError: (error) => toast(errorMessage(error), 'error') })
                  : undefined
              }
            />
          </>
        }
      />
      {post.isPending ? (
        <Loading />
      ) : !post.data ? (
        <ErrorState error={post.error} onRetry={() => void post.refetch()} />
      ) : (
        <>
          <FlatList
            data={rows}
            keyExtractor={(row) => row.comment.id}
            ListHeaderComponent={<PostBody post={post.data} />}
            renderItem={({ item, index }) => (
              <AppearItem index={index}>
                <CommentRow row={item} onReply={setReplyTo} />
              </AppearItem>
            )}
            onEndReached={comments.loadMore}
            ListEmptyComponent={
              comments.isPending ? (
                <ListFooter loading />
              ) : (
                <EmptyState icon={MessageSquare} title={tr('feed.no_comments')} body={tr('feed.no_comments_body')} />
              )
            }
            ListFooterComponent={<ListFooter loading={comments.isFetchingNextPage} />}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
          <CommentComposer postId={id} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  post: { padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  image: { width: '100%', borderRadius: radius.md },
  hiddenImage: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill },
  section: { marginTop: 8 },
});
