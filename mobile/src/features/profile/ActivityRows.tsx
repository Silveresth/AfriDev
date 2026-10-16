import { CircleDot, FolderGit2, Star } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useT } from '@/shared/i18n';
import { formatCount, languageColor, openLink } from '@/shared/lib';
import { PressableScale } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { Tag, TagRow, Text } from '@/shared/ui';

import type { Project } from './api';

/** Projet open source : ouvre le dépôt. */
export const ProjectRow = memo(function ProjectRow({ project }: { project: Project }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <Animated.View entering={FadeIn} style={[styles.row, { borderBottomColor: colors.line }]}>
      <PressableScale scaleTo={0.98} onPress={() => project.repo_url && void openLink(project.repo_url)} style={styles.gap}>
        <View style={styles.inline}>
          <FolderGit2 size={16} color={colors.inkMuted} />
          <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
            {project.name}
          </Text>
          {project.is_recruiting ? <Tag label={t('project.recruiting')} tone="success" /> : null}
        </View>
        {project.description ? (
          <Text variant="small" tone="muted" numberOfLines={3}>
            {project.description}
          </Text>
        ) : null}
        <View style={styles.inline}>
          {project.language ? (
            <>
              <View style={[styles.dot, { backgroundColor: languageColor(project.language) }]} />
              <Text variant="caption" tone="faint">
                {project.language}
              </Text>
            </>
          ) : null}
          <Star size={12} color={colors.inkFaint} />
          <Text variant="caption" tone="faint">
            {formatCount(project.stars)}
          </Text>
          <CircleDot size={12} color={colors.inkFaint} />
          <Text variant="caption" tone="faint">
            {t('project.issues', { count: project.open_issue_count })}
          </Text>
        </View>
        <TagRow tags={project.tags} />
      </PressableScale>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  gap: { gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  flex: { flex: 1 },
});
