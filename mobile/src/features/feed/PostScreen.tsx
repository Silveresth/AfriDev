import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ImageIcon, MessageSquare, Share2, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Pressable, Share, StyleSheet, View } from 'react-native';

import { absoluteUrl, PUBLIC_WEB_URL } from '@/shared/api';
import { TranslateBar } from '@/features/translation';
import { useDataSaver } from '@/shared/data-saver';
import { useT } from '@/shared/i18n';
import { formatCount } from '@/shared/lib';
import { AppearItem } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { EmptyState, ErrorState, Header, IconButton, ListFooter, Loading, Markdown, TagRow, Text } from '@/shared/ui';

import { type Comment, imageOf, type Post, useComments, useDeletePost, usePost } from './api';
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

  const share = () => {
    if (!post.data) return;
    void Share.share({ message: `${post.data.title || tr('feed.share_default')} — ${PUBLIC_WEB_URL}/feed/${post.data.id}` });
  };

  const confirmDelete = () =>
    Alert.alert(tr('feed.delete_title'), tr('feed.delete_body'), [
      { text: tr('common.cancel'), style: 'cancel' },
      {
        text: tr('common.delete'),
        style: 'destructive',
        onPress: () => remove.mutate(id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={post.data?.hub ? `h/${post.data.hub.slug}` : tr('feed.post')}
        back
        right={
          <>
            <IconButton icon={Share2} label={tr('feed.share')} onPress={share} />
            {isMine ? <IconButton icon={Trash2} label={tr('common.delete')} color={colors.danger} onPress={confirmDelete} /> : null}
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
