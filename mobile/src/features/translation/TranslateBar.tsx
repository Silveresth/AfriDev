import { getFallbackLocale } from '@afridev/i18n';
import { useMutation } from '@tanstack/react-query';
import { Languages, Lightbulb } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { api, ApiError, errorMessage, type Schemas, unwrap } from '@/shared/api';
import { type LocaleCode, t as translateKey, useT } from '@/shared/i18n';
import { Dots, haptic, PressableScale } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';
import { Markdown, Text } from '@/shared/ui';

type Translation = Schemas['TranslationOutput'];
type Target = Schemas['TargetLanguageEnum'];
type Mode = 'translate' | 'simplify';

const TARGETS: readonly string[] = ['fr', 'en', 'pt', 'ar', 'sw', 'wo', 'bm', 'dyu', 'mos', 'ha', 'yo', 'ig', 'ln', 'rw', 'am', 'zu'];

/** Langue cible : celle de l'interface, sinon sa langue de repli (kirundi → kinyarwanda), sinon français. */
function targetFor(locale: LocaleCode): Target {
  if (TARGETS.includes(locale)) return locale as Target;
  const fallback = getFallbackLocale(locale);
  return (TARGETS.includes(fallback) ? fallback : 'fr') as Target;
}

/** La traduction tourne en tâche de fond : on la suit jusqu'au résultat (40 s maximum). */
async function waitForTranslation(first: Translation): Promise<Translation> {
  let current = first;
  for (let attempt = 0; current.status === 'pending' && attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    current = await unwrap(api.GET('/api/translation/{translation_id}/', { params: { path: { translation_id: current.id } } }));
  }
  if (current.status !== 'ready') throw new ApiError(translateKey('translate.failed'), 'translation_failed', 0);
  return current;
}

function Pill({ icon: Icon, label, active, onPress }: { icon: typeof Languages; label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={[styles.pill, { backgroundColor: active ? colors.tertiarySoft : colors.container }]}
    >
      <Icon size={15} color={active ? colors.tertiary : colors.inkMuted} />
      <Text variant="caption" style={[styles.pillText, { color: active ? colors.tertiary : colors.inkMuted }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * « Traduire » / « Vulgariser » un contenu (post, question, réponse, commentaire) vers la langue
 * de l'interface. Le résultat est mis en cache côté serveur : la 2e demande est instantanée.
 */
export function TranslateBar({ text, compact = false }: { text: string; compact?: boolean }) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const [result, setResult] = useState<{ mode: Mode; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: async (mode: Mode) => {
      const first = await unwrap(api.POST('/api/translation/', { body: { text, target_language: targetFor(locale), mode } }));
      return { mode, translation: await waitForTranslation(first) };
    },
    onSuccess: ({ mode, translation }) => {
      haptic.success();
      setResult({ mode, text: translation.result });
    },
  });

  const toggle = (mode: Mode) => {
    if (result?.mode === mode) setResult(null);
    else mutation.mutate(mode);
  };

  if (!text.trim()) return null;
  return (
    <Animated.View layout={LinearTransition.springify().damping(18)} style={styles.wrap}>
      <View style={styles.row}>
        <Pill
          icon={Languages}
          label={t(result?.mode === 'translate' ? 'feed.original' : 'feed.translate')}
          active={result?.mode === 'translate'}
          onPress={() => toggle('translate')}
        />
        {compact ? null : (
          <Pill
            icon={Lightbulb}
            label={t(result?.mode === 'simplify' ? 'feed.original' : 'feed.simplify')}
            active={result?.mode === 'simplify'}
            onPress={() => toggle('simplify')}
          />
        )}
        {mutation.isPending ? <Dots /> : null}
      </View>
      {mutation.isError ? (
        <Text variant="small" tone="danger">
          {errorMessage(mutation.error)}
        </Text>
      ) : null}
      {result ? (
        <Animated.View
          key={result.mode}
          entering={FadeInDown.duration(280)}
          exiting={FadeOut.duration(150)}
          style={[styles.result, { backgroundColor: colors.tertiarySoft }]}
        >
          <Text variant="caption" style={[styles.resultTitle, { color: colors.tertiary }]}>
            {t(result.mode === 'translate' ? 'feed.translation_ai' : 'feed.simplify_ai')}
          </Text>
          <Markdown source={result.text} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: radius.pill },
  pillText: { fontWeight: '600' },
  result: { padding: 12, borderRadius: radius.md, gap: 6 },
  resultTitle: { fontWeight: '700' },
});
