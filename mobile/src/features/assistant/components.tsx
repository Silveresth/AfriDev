import { router } from 'expo-router';
import { Briefcase, CheckCircle2, CircleAlert, Copy, GraduationCap, Send, Sparkles, Sun, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { openLink } from '@/shared/lib';
import { radius, typography, useTheme } from '@/shared/theme';
import { Avatar, Button, Sheet, TagRow, Text, useToast } from '@/shared/ui';

import { type CodeIssue, type TeamCandidate, useCodeReview, useDigest, useInviteTeammate, useJobMatch, useTeamSuggestions } from './api';

function scoreColor(score: number, colors: ReturnType<typeof useTheme>['colors']) {
  return score >= 70 ? colors.secondaryInk : score >= 45 ? colors.tertiary : colors.danger;
}

function Panel({ icon: Icon, title, subtitle, action, children }: { icon: typeof Sparkles; title: string; subtitle: string; action: React.ReactNode; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, { borderColor: colors.line, backgroundColor: colors.background }]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
          <Icon size={16} color={colors.primaryInk} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        </View>
      </View>
      {action}
      {children}
    </View>
  );
}

/** 1. « Vous correspondez à 82 % » sur une offre, avec plan d'apprentissage. */
export function JobMatchSection({ jobId }: { jobId: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const match = useJobMatch();
  const result = match.data;
  return (
    <Panel
      icon={Sparkles}
      title={t('ai.match_title')}
      subtitle={t('ai.match_sub')}
      action={<Button label={t(result ? 'ai.recompute' : 'ai.match_cta')} size="sm" variant="secondary" loading={match.isPending} onPress={() => match.mutate(jobId)} />}
    >
      {match.isError ? (
        <Text variant="small" tone="danger">
          {errorMessage(match.error)}
        </Text>
      ) : null}
      {result ? (
        <View style={styles.gap}>
          <View style={styles.inline}>
            <Text style={[styles.score, { color: scoreColor(result.score, colors) }]}>{result.score}%</Text>
            <Text variant="small" style={styles.flex}>
              {result.verdict}
            </Text>
          </View>
          {result.strengths.map((item) => (
            <View key={item} style={styles.line}>
              <CheckCircle2 size={15} color={colors.secondaryInk} />
              <Text variant="small" style={styles.flex}>
                {item}
              </Text>
            </View>
          ))}
          {result.gaps.map((item) => (
            <View key={item} style={styles.line}>
              <CircleAlert size={15} color={colors.tertiary} />
              <Text variant="small" style={styles.flex}>
                {item}
              </Text>
            </View>
          ))}
          {result.plan.length ? (
            <View style={[styles.box, { backgroundColor: colors.surface }]}>
              <View style={styles.inline}>
                <GraduationCap size={15} color={colors.ink} />
                <Text variant="smallStrong">{t('ai.plan')}</Text>
              </View>
              {result.plan.map((step, index) => (
                <Text key={index} variant="small">
                  {index + 1}. {step.step}
                  {step.resource ? <Text variant="small" tone="muted">{` — ${step.resource}`}</Text> : null}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Panel>
  );
}

/** 3. Relecture IA d'un snippet. */
export function CodeReviewSection({ snippetId }: { snippetId: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const review = useCodeReview();
  const result = review.data;
  const tone: Record<CodeIssue['severity'], string> = { critique: colors.danger, important: colors.tertiary, mineur: colors.inkMuted };
  return (
    <Panel
      icon={Sparkles}
      title={t('ai.review_title')}
      subtitle={t('ai.review_sub')}
      action={<Button label={t(result ? 'ai.recompute' : 'ai.review_cta')} size="sm" variant="secondary" loading={review.isPending} onPress={() => review.mutate(snippetId)} />}
    >
      {review.isError ? (
        <Text variant="small" tone="danger">
          {errorMessage(review.error)}
        </Text>
      ) : null}
      {result ? (
        <View style={styles.gap}>
          <View style={styles.inline}>
            <Text style={[styles.score, { color: scoreColor(result.score, colors) }]}>{result.score}</Text>
            <Text variant="small" style={styles.flex}>
              {result.summary}
            </Text>
          </View>
          {result.issues.map((issue, index) => (
            <View key={index} style={[styles.box, { backgroundColor: colors.surface }]}>
              <Text variant="caption" style={{ color: tone[issue.severity], fontWeight: '700' }}>
                {issue.severity.toUpperCase()} · {issue.category}
                {issue.line ? ` · L${issue.line}` : ''}
              </Text>
              <Text variant="smallStrong">{issue.title}</Text>
              {issue.detail ? (
                <Text variant="small" tone="muted">
                  {issue.detail}
                </Text>
              ) : null}
              {issue.suggestion ? (
                <Pressable
                  onPress={async () => {
                    await Clipboard.setStringAsync(issue.suggestion);
                    toast(t('dm.copied'));
                  }}
                  style={[styles.code, { backgroundColor: colors.codeBg }]}
                >
                  <Text variant="caption" style={{ color: colors.codeInk, fontFamily: 'monospace' }}>
                    {issue.suggestion}
                  </Text>
                  <Copy size={13} color={colors.codeInk} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Panel>
  );
}

/** 5. Résumé du jour, en tête du fil d'accueil. */
export function DigestCard() {
  const { colors } = useTheme();
  const { t } = useT();
  const digest = useDigest();
  if (digest.isError || (digest.isSuccess && !digest.data)) return null;
  return (
    <View style={[styles.digest, { backgroundColor: colors.primarySoft }]}>
      <View style={styles.inline}>
        <Sun size={16} color={colors.primaryInk} />
        <Text variant="bodyStrong" style={{ color: colors.primaryInk }}>
          {digest.data?.headline ?? t('ai.digest')}
        </Text>
      </View>
      {digest.isPending ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        digest.data?.items.map((item, index) => (
          <Pressable key={index} disabled={!item.url} onPress={() => item.url && void openLink(item.url)} style={styles.digestItem}>
            <Text variant="small">{item.emoji}</Text>
            <Text variant="small" style={styles.flex}>
              {item.text}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

/** 7. Porteur de projet : coéquipiers proposés par l'IA, invitation en un geste. */
export function TeamSection({ projectId }: { projectId: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const suggestions = useTeamSuggestions();
  const [inviting, setInviting] = useState<TeamCandidate | null>(null);
  const result = suggestions.data;
  return (
    <Panel
      icon={UsersRound}
      title={t('ai.team_title')}
      subtitle={t('ai.team_sub')}
      action={<Button label={t(result ? 'ai.recompute' : 'ai.team_cta')} size="sm" variant="secondary" loading={suggestions.isPending} onPress={() => suggestions.mutate(projectId)} />}
    >
      {suggestions.isError ? (
        <Text variant="small" tone="danger">
          {errorMessage(suggestions.error)}
        </Text>
      ) : null}
      {result && !result.candidates.length ? (
        <Text variant="small" tone="muted">
          {t('ai.team_empty')}
        </Text>
      ) : null}
      {result?.candidates.map((candidate) => (
        <View key={candidate.username} style={[styles.candidate, { borderColor: colors.line }]}>
          <Pressable onPress={() => router.push(`/u/${candidate.username}`)} style={styles.candidateMain}>
            <Avatar name={candidate.display_name} src={candidate.avatar_url} size={42} />
            <View style={styles.flex}>
              <View style={styles.inline}>
                <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
                  {candidate.display_name}
                </Text>
                {candidate.open_to_work ? <Briefcase size={13} color={colors.secondaryInk} /> : null}
                <Text variant="caption" style={{ color: colors.primaryInk, fontWeight: '700' }}>
                  {candidate.fit}%
                </Text>
              </View>
              <Text variant="caption" tone="muted" numberOfLines={2}>
                {candidate.role} · {candidate.reason}
              </Text>
              <TagRow tags={candidate.stack} />
            </View>
          </Pressable>
          <Button label={t('ai.invite')} size="sm" icon={Send} onPress={() => setInviting(candidate)} />
        </View>
      ))}
      {inviting && result ? (
        <InviteSheet
          projectId={projectId}
          candidate={inviting}
          draft={result.invitation.replaceAll('{prenom}', inviting.display_name.split(' ')[0] ?? inviting.display_name)}
          onClose={() => setInviting(null)}
        />
      ) : null}
    </Panel>
  );
}

function InviteSheet({ projectId, candidate, draft, onClose }: { projectId: string; candidate: TeamCandidate; draft: string; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const invite = useInviteTeammate();
  const [message, setMessage] = useState(draft);
  return (
    <Sheet visible onClose={onClose} title={t('ai.invite_title', { name: candidate.display_name })}>
      <View style={styles.sheet}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={1500}
          style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.container }]}
        />
        <Button
          label={t('ai.send_invite')}
          icon={Send}
          block
          loading={invite.isPending}
          onPress={() =>
            invite.mutate(
              { project_id: projectId, username: candidate.username, message },
              {
                onSuccess: () => {
                  toast(t('ai.invited', { name: candidate.display_name }));
                  onClose();
                },
                onError: (error) => Alert.alert(errorMessage(error)),
              },
            )
          }
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  gap: { gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  panel: { gap: 12, marginHorizontal: 16, marginVertical: 8, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: 30, fontWeight: '800' },
  box: { gap: 4, padding: 10, borderRadius: radius.md },
  code: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 8, borderRadius: radius.sm, marginTop: 4 },
  digest: { gap: 6, marginHorizontal: 16, marginTop: 10, marginBottom: 4, padding: 14, borderRadius: radius.lg },
  digestItem: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  candidate: { gap: 8, padding: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  candidateMain: { flexDirection: 'row', gap: 10 },
  sheet: { gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
  input: { minHeight: 120, maxHeight: 220, borderRadius: radius.md, padding: 12, textAlignVertical: 'top' },
});
