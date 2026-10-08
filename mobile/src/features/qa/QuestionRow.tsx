import { router } from 'expo-router';
import { CheckCircle2, Sparkles } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useT } from '@/shared/i18n';
import { plainText, timeAgo } from '@/shared/lib';
import { radius, useTheme } from '@/shared/theme';
import { TagRow, Text } from '@/shared/ui';

import type { Question } from './api';

/** Compteur de réponses à gauche (vert plein si résolue), comme sur Stack Overflow. */
export const QuestionRow = memo(function QuestionRow({ question }: { question: Question }) {
  const { colors } = useTheme();
  const { t } = useT();
  const resolved = question.is_resolved;
  return (
    <Pressable
      onPress={() => router.push(`/question/${question.id}`)}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed && { backgroundColor: colors.pressed }]}
    >
      <View
        style={[
          styles.count,
          resolved
            ? { backgroundColor: colors.secondary, borderColor: colors.secondary }
            : { borderColor: question.answer_count ? colors.secondary : colors.lineStrong },
        ]}
      >
        {resolved ? <CheckCircle2 size={14} color="#FFFFFF" /> : null}
        <Text variant="smallStrong" style={{ color: resolved ? '#FFFFFF' : question.answer_count ? colors.secondaryInk : colors.inkMuted }}>
          {question.answer_count}
        </Text>
      </View>
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {question.title}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={2}>
          {plainText(question.body, 160)}
        </Text>
        <TagRow tags={question.tags} />
        <View style={styles.meta}>
          {question.ai_answer_status === 'ready' ? (
            <View style={styles.ai}>
              <Sparkles size={12} color={colors.tertiary} />
              <Text variant="caption" style={{ color: colors.tertiary }}>
                {t('qa.ai_badge')}
              </Text>
            </View>
          ) : null}
          <Text variant="caption" tone="faint" numberOfLines={1} style={styles.flex}>
            @{question.author?.username ?? t('member')} · {timeAgo(question.created_at)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  count: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  body: { flex: 1, gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ai: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
});
