import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Banknote, Building2, Globe2, MapPin, Send } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { JobMatchSection } from '@/features/assistant';
import { ActionBar, TargetComments, useDeleteCard, useReaction } from '@/features/engage';
import { api, errorMessage, PUBLIC_WEB_URL, unwrap } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { openLink, profileColorHex, timeAgo } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { Avatar, Button, ErrorState, Header, Loading, TagRow, Text, useToast } from '@/shared/ui';

const CONTRACTS: Record<string, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  freelance: 'Freelance',
  stage: 'Stage',
  alternance: 'Alternance',
  temps_partiel: 'Temps partiel',
};

/** Offre d'emploi : description complète, postuler, votes, commentaires, partage, enregistrement. */
export function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const { user } = useSession();
  const job = useQuery({
    queryKey: ['jobs', 'detail', id],
    queryFn: () => unwrap(api.GET('/api/job-board/{job_id}/', { params: { path: { job_id: id } } })),
  });
  const { summary, vote } = useReaction('job', id);
  const remove = useDeleteCard();
  const data = job.data;
  const canManage = Boolean(user && (data?.author?.id === user.id || user.is_staff));
  const place = data ? [data.location, data.country].filter(Boolean).join(', ') : '';
  const apply = data ? (/^https?:\/\//.test(data.apply_url) ? data.apply_url : `mailto:${data.apply_url.replace(/^mailto:/, '')}`) : '';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title={data?.company ?? t('home.type.job')} back />
      {job.isPending ? (
        <Loading />
      ) : !data ? (
        <ErrorState error={job.error} onRetry={() => void job.refetch()} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.body}>
            <View style={styles.top}>
              <View style={[styles.mark, { backgroundColor: profileColorHex(data.company) }]}>
                <Text style={styles.markLetter}>{data.company.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.flex}>
                <Text variant="title">{data.title}</Text>
                <View style={styles.inline}>
                  <Building2 size={14} color={colors.inkMuted} />
                  <Text variant="small" tone="muted">
                    {data.company}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.facts}>
              <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                <Text variant="caption" tone="primary">
                  {CONTRACTS[data.contract_type] ?? data.contract_type}
                </Text>
              </View>
              {data.is_remote ? (
                <View style={[styles.badge, styles.inline, { backgroundColor: colors.secondarySoft }]}>
                  <Globe2 size={12} color={colors.secondaryInk} />
                  <Text variant="caption" tone="secondary">
                    {t('home.remote')}
                  </Text>
                </View>
              ) : null}
              {place ? (
                <View style={styles.inline}>
                  <MapPin size={13} color={colors.inkFaint} />
                  <Text variant="small" tone="muted">
                    {place}
                  </Text>
                </View>
              ) : null}
              {data.salary_range ? (
                <View style={styles.inline}>
                  <Banknote size={13} color={colors.inkFaint} />
                  <Text variant="smallStrong">{data.salary_range}</Text>
                </View>
              ) : null}
            </View>
            <TagRow tags={data.stack} />
            <Text selectable>{data.description}</Text>
            {data.is_active ? <Button label={t('home.apply')} icon={Send} block onPress={() => void openLink(apply)} /> : (
              <Text variant="smallStrong" tone="muted">
                {t('job.filled')}
              </Text>
            )}
            {data.author ? (
              <Pressable onPress={() => router.push(`/u/${data.author!.username}`)} style={[styles.owner, { backgroundColor: colors.surface }]}>
                <Avatar name={data.author.display_name} src={data.author.avatar_url} size={40} />
                <View style={styles.flex}>
                  <Text variant="caption" tone="muted">
                    {t('job.posted', { when: timeAgo(data.created_at) })}
                  </Text>
                  <Text variant="bodyStrong">{data.author.display_name}</Text>
                </View>
              </Pressable>
            ) : null}
            <ActionBar
              vote={{ score: summary.data?.score ?? 0, value: summary.data?.viewer_vote ?? 0, onVote: (value) => vote.mutate(value) }}
              share={{ title: `${data.title} — ${data.company}`, path: `/jobs/${data.id}` }}
              save={{ type: 'job', id: data.id }}
              more={{
                report: canManage ? undefined : { type: 'job', id: data.id },
                onEdit: canManage ? () => void openLink(`${PUBLIC_WEB_URL}/jobs/${data.id}?edit=1`) : undefined,
                editLabel: t('act.open_web'),
                onDelete: canManage
                  ? () =>
                      remove.mutate(
                        { type: 'job', id: data.id },
                        { onSuccess: () => router.back(), onError: (error) => toast(errorMessage(error), 'error') },
                      )
                  : undefined,
              }}
            />
          </View>
          {!canManage && data.is_active ? <JobMatchSection jobId={data.id} /> : null}
          <TargetComments type="job" id={data.id} ownerId={data.author?.id} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  body: { gap: 14, padding: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mark: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  markLetter: { color: '#fff', fontSize: 24, fontWeight: '800' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md },
});
