import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleDot, ExternalLink, FolderGit2, Star } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TeamSection } from '@/features/assistant';
import { ActionBar, TargetComments, useDeleteCard, useReaction } from '@/features/engage';
import { absoluteUrl, api, errorMessage, PUBLIC_WEB_URL, unwrap } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { formatCount, languageColor, openLink, profileColorHex, timeAgo } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { Avatar, Button, ErrorState, Header, Loading, TagRow, Text, useToast } from '@/shared/ui';

/** Page projet : présentation, votes, commentaires, partage, enregistrement, issues à prendre. */
export function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const { user } = useSession();
  const project = useQuery({
    queryKey: ['projects', 'detail', id],
    queryFn: () => unwrap(api.GET('/api/projects/{project_id}/', { params: { path: { project_id: id } } })),
  });
  const issues = useQuery({
    queryKey: ['projects', 'issues', id],
    queryFn: () => unwrap(api.GET('/api/projects/{project_id}/issues/', { params: { path: { project_id: id } } })),
  });
  const { summary, vote } = useReaction('project', id);
  const remove = useDeleteCard();
  const data = project.data;
  const mine = Boolean(user && data?.owner?.id === user.id);
  const canManage = mine || Boolean(user?.is_staff);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title={data?.name ?? t('home.type.project')} back />
      {project.isPending ? (
        <Loading />
      ) : !data ? (
        <ErrorState error={project.error} onRetry={() => void project.refetch()} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {data.banner_url ? (
            <Image source={{ uri: absoluteUrl(data.banner_url) }} style={styles.banner} contentFit="cover" />
          ) : (
            <View style={[styles.banner, styles.bannerEmpty, { backgroundColor: colors.container }]} />
          )}
          <View style={styles.body}>
            {data.logo_url ? (
              <Image source={{ uri: absoluteUrl(data.logo_url) }} style={[styles.logo, { borderColor: colors.background }]} contentFit="cover" />
            ) : (
              <View style={[styles.logo, { borderColor: colors.background, backgroundColor: profileColorHex(data.name) }]}>
                <Text style={styles.logoLetter}>{data.name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <Text variant="title">{data.name}</Text>
            {data.description ? <Text>{data.description}</Text> : null}
            <View style={styles.facts}>
              <View style={styles.inline}>
                <Star size={14} color={colors.tertiary} />
                <Text variant="small" tone="muted">
                  {formatCount(data.stars)}
                </Text>
              </View>
              {data.language ? (
                <View style={styles.inline}>
                  <View style={[styles.dot, { backgroundColor: languageColor(data.language) }]} />
                  <Text variant="small" tone="muted">
                    {data.language}
                  </Text>
                </View>
              ) : null}
              {data.is_recruiting ? (
                <Text variant="smallStrong" tone="secondary">
                  {t('home.recruiting')}
                </Text>
              ) : null}
            </View>
            <TagRow tags={data.tags} />
            {data.owner ? (
              <Pressable onPress={() => router.push(`/u/${data.owner!.username}`)} style={[styles.owner, { backgroundColor: colors.surface }]}>
                <Avatar name={data.owner.display_name} src={data.owner.avatar_url} size={40} />
                <View style={styles.flex}>
                  <Text variant="caption" tone="muted">
                    {t('proj.by')}
                  </Text>
                  <Text variant="bodyStrong">{data.owner.display_name}</Text>
                </View>
              </Pressable>
            ) : null}
            {data.repo_url ? <Button label={t('home.repo')} icon={FolderGit2} variant="secondary" block onPress={() => void openLink(data.repo_url)} /> : null}
            <ActionBar
              vote={{ score: summary.data?.score ?? 0, value: summary.data?.viewer_vote ?? 0, onVote: (value) => vote.mutate(value) }}
              share={{ title: data.name, path: `/projects/${data.id}` }}
              save={{ type: 'project', id: data.id }}
              more={{
                report: canManage ? undefined : { type: 'project', id: data.id },
                onEdit: canManage ? () => void openLink(`${PUBLIC_WEB_URL}/projects/${data.id}/edit`) : undefined,
                editLabel: t('act.open_web'),
                onDelete: canManage
                  ? () =>
                      remove.mutate(
                        { type: 'project', id: data.id },
                        { onSuccess: () => router.back(), onError: (error) => toast(errorMessage(error), 'error') },
                      )
                  : undefined,
              }}
            />
          </View>

          {issues.data?.length ? (
            <View style={[styles.issues, { borderTopColor: colors.line }]}>
              <Text variant="headline">Good first issues</Text>
              {issues.data.map((issue) => (
                <Pressable key={issue.id} onPress={() => void openLink(issue.url)} style={({ pressed }) => [styles.issue, pressed && { backgroundColor: colors.pressed }]}>
                  <CircleDot size={18} color={colors.secondaryInk} />
                  <Text style={styles.flex} numberOfLines={2}>
                    <Text tone="faint">#{issue.number} </Text>
                    {issue.title}
                  </Text>
                  <ExternalLink size={14} color={colors.inkFaint} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {canManage ? <TeamSection projectId={data.id} /> : null}
          <TargetComments type="project" id={data.id} ownerId={data.owner?.id} />
          <Text variant="caption" tone="faint" style={styles.updated}>
            {data.last_synced_at ? t('proj.synced', { when: timeAgo(data.last_synced_at) }) : ''}
          </Text>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  banner: { width: '100%', height: 140 },
  bannerEmpty: { height: 96 },
  body: { gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  logo: { width: 76, height: 76, borderRadius: 20, borderWidth: 4, marginTop: -38, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoLetter: { color: '#fff', fontSize: 30, fontWeight: '800' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md },
  issues: { gap: 4, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  issue: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderRadius: radius.sm },
  updated: { paddingHorizontal: 16, paddingTop: 8 },
});
