import { Check, Compass, Cpu, Sparkles, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHubs } from '@/features/hubs/api';
import { useUpdateProfile } from '@/features/profile/api';
import { useT } from '@/shared/i18n';
import { haptic } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';
import { Button, HubIcon, Text } from '@/shared/ui';

const POPULAR_STACKS = [
  'Python',
  'TypeScript',
  'React',
  'Next.js',
  'Django',
  'FastAPI',
  'Flutter',
  'React Native',
  'Go',
  'Rust',
  'Docker',
  'PostgreSQL',
  'Tailwind CSS',
  'AWS',
  'AI / LLM',
];

const INTEREST_TOPICS = [
  { id: 'mobile_money', label: 'Mobile Money & Paiement', icon: '💳' },
  { id: 'ussd_offline', label: 'USSD & Mode Hors-Ligne', icon: '📶' },
  { id: 'ai_africa', label: 'IA & LLM Panafricain', icon: '🤖' },
  { id: 'cloud_infra', label: 'Cloud & DevOps', icon: '☁️' },
  { id: 'startups', label: 'Startups & FinTech', icon: '🚀' },
  { id: 'open_source', label: 'Open Source', icon: '🌍' },
  { id: 'security', label: 'Cybersécurité', icon: '🛡️' },
  { id: 'careers', label: 'Carrière & Recrutement', icon: '💼' },
];

export function OnboardingPreferencesModal({
  visible,
  onComplete,
}: {
  visible: boolean;
  onComplete: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const updateProfile = useUpdateProfile();
  const hubsQuery = useHubs('popular');

  const [selectedStack, setSelectedStack] = useState<string[]>(['TypeScript', 'Python']);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(['mobile_money', 'ai_africa']);
  const [selectedHubs, setSelectedHubs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleStack = (tech: string) => {
    haptic.select();
    setSelectedStack((prev) =>
      prev.includes(tech) ? prev.filter((item) => item !== tech) : [...prev, tech]
    );
  };

  const toggleTopic = (id: string) => {
    haptic.select();
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleHub = (slug: string) => {
    haptic.select();
    setSelectedHubs((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({ stack: selectedStack });
    } catch {
      // Ignorer
    } finally {
      setSaving(false);
      onComplete();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onComplete}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* En-tête */}
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
              <Sparkles size={14} color={colors.primary} />
              <Text variant="caption" tone="primary" style={styles.badgeText}>
                Bienvenue sur AfriDev !
              </Text>
            </View>
            <Text variant="title">
              {t('onboarding.title')}
            </Text>
            <Text variant="small" tone="muted">
              {t('onboarding.subtitle')}
            </Text>
          </View>

          {/* Section 1 : Thématiques */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Compass size={18} color={colors.primary} />
              <Text variant="smallStrong">{t('onboarding.topics')}</Text>
            </View>
            <View style={styles.topicsGrid}>
              {INTEREST_TOPICS.map((topic) => {
                const active = selectedTopics.includes(topic.id);
                return (
                  <Pressable
                    key={topic.id}
                    onPress={() => toggleTopic(topic.id)}
                    style={[
                      styles.topicCard,
                      {
                        backgroundColor: active ? colors.primarySoft : colors.container,
                        borderColor: active ? colors.primary : colors.line,
                      },
                    ]}
                  >
                    <Text style={styles.topicIcon}>{topic.icon}</Text>
                    <Text variant="caption" tone={active ? 'primary' : 'muted'} numberOfLines={2} style={styles.topicLabel}>
                      {topic.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Section 2 : Stack technique */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Cpu size={18} color={colors.primary} />
              <View style={styles.flex}>
                <Text variant="smallStrong">{t('onboarding.tech_stack')}</Text>
                <Text variant="caption" tone="muted">{t('onboarding.tech_stack_desc')}</Text>
              </View>
            </View>
            <View style={styles.chipsRow}>
              {POPULAR_STACKS.map((tech) => {
                const active = selectedStack.includes(tech);
                return (
                  <Pressable
                    key={tech}
                    onPress={() => toggleStack(tech)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.container,
                        borderColor: active ? colors.primary : colors.line,
                      },
                    ]}
                  >
                    {active ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                    <Text variant="smallStrong" style={{ color: active ? '#FFFFFF' : colors.ink }}>
                      {tech}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Section 3 : Hubs recommandés */}
          {hubsQuery.items.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Users size={18} color={colors.primary} />
                <View style={styles.flex}>
                  <Text variant="smallStrong">{t('onboarding.hubs')}</Text>
                  <Text variant="caption" tone="muted">{t('onboarding.hubs_desc')}</Text>
                </View>
              </View>
              <View style={styles.hubsList}>
                {hubsQuery.items.slice(0, 4).map((hub) => {
                  const active = selectedHubs.includes(hub.slug);
                  return (
                    <Pressable
                      key={hub.id}
                      onPress={() => toggleHub(hub.slug)}
                      style={[
                        styles.hubCard,
                        {
                          backgroundColor: active ? colors.primarySoft : colors.container,
                          borderColor: active ? colors.primary : colors.line,
                        },
                      ]}
                    >
                      <View style={styles.hubLeft}>
                        <HubIcon name={hub.name} icon={hub.icon} size={32} />
                        <View style={styles.hubText}>
                          <Text variant="smallStrong" numberOfLines={1}>d/{hub.slug}</Text>
                          <Text variant="caption" tone="muted" numberOfLines={1}>{hub.name}</Text>
                        </View>
                      </View>
                      <View style={[styles.hubCheck, { borderColor: active ? colors.primary : colors.lineStrong, backgroundColor: active ? colors.primary : 'transparent' }]}>
                        {active ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : <Text variant="caption" tone="muted">+</Text>}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              label={t('onboarding.finish')}
              variant="primary"
              block
              loading={saving}
              onPress={handleFinish}
            />
            <Button
              label={t('onboarding.skip')}
              variant="ghost"
              onPress={onComplete}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 22 },
  header: { gap: 6, marginTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontWeight: '700' },
  section: { gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicCard: { width: '48%', padding: 12, borderRadius: radius.md, borderWidth: 1, gap: 6 },
  topicIcon: { fontSize: 20 },
  topicLabel: { fontWeight: '600', lineHeight: 15 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  hubsList: { gap: 8 },
  hubCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: radius.md, borderWidth: 1 },
  hubLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  hubText: { flex: 1 },
  hubCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 8, marginTop: 12 },
  flex: { flex: 1 },
});
