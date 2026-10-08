import { getFallbackLocale } from '@afridev/i18n';
import { Check, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { LANG_MAP, LANGUAGES, type LangMeta, type LocaleCode, t as translate, useT } from '@/shared/i18n';
import { AppearItem, haptic, PressableScale } from '@/shared/motion';
import { radius, typography, useTheme } from '@/shared/theme';
import { Badge, Chips, Header, Text, useToast } from '@/shared/ui';

type Filter = 'all' | 'african' | 'international';

const FEATURED = LANGUAGES.filter((lang) => lang.complete);

/** Tuile d'une langue entièrement traduite (accès direct). */
function FeaturedTile({ lang, active, onPress }: { lang: LangMeta; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.94}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[
        styles.tile,
        { borderColor: active ? colors.primary : colors.line, backgroundColor: active ? colors.primarySoft : colors.background },
      ]}
    >
      <View style={styles.tileTop}>
        <Text style={styles.flag}>{lang.flag}</Text>
        {active ? (
          <Animated.View entering={ZoomIn.springify().damping(10)} style={[styles.check, { backgroundColor: colors.primary }]}>
            <Check size={12} color={colors.onPrimary} strokeWidth={3} />
          </Animated.View>
        ) : (
          <Text variant="caption" tone="faint">
            {lang.code.toUpperCase()}
          </Text>
        )}
      </View>
      <Text variant="smallStrong" numberOfLines={1} style={active ? { color: colors.primaryInk } : null}>
        {lang.native}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {lang.label}
      </Text>
    </PressableScale>
  );
}

function LanguageRow({ lang, active, onPress }: { lang: LangMeta; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const fallback = LANG_MAP.get(getFallbackLocale(lang.code));
  return (
    <PressableScale
      scaleTo={0.985}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[styles.row, { borderBottomColor: colors.line }, active && { backgroundColor: colors.primarySoft }]}
    >
      <Text style={styles.flag}>{lang.flag}</Text>
      <View style={styles.flex}>
        <View style={styles.inline}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
            {lang.native}
          </Text>
          <Text variant="caption" tone="faint">
            {lang.label}
          </Text>
        </View>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {lang.countries.join(', ')}
        </Text>
      </View>
      {active ? (
        <Animated.View entering={ZoomIn.springify().damping(10)} style={[styles.check, { backgroundColor: colors.primary }]}>
          <Check size={12} color={colors.onPrimary} strokeWidth={3} />
        </Animated.View>
      ) : lang.complete ? (
        <Badge label="100 %" tone="success" />
      ) : (
        <Badge label={t('lang.partial', { lang: fallback?.native ?? 'Français' })} />
      )}
    </PressableScale>
  );
}

/** Langue de l'interface : même catalogue et même repli intelligent que le web. */
export function LanguageScreen() {
  const { colors } = useTheme();
  const { t, locale, setLocale } = useT();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LANGUAGES.filter((lang) => {
      if (filter !== 'all' && lang.category !== filter) return false;
      if (!q) return true;
      return (
        lang.native.toLowerCase().includes(q) ||
        lang.label.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q) ||
        lang.countries.some((country) => country.toLowerCase().includes(q))
      );
    });
  }, [filter, search]);

  const choose = (code: LocaleCode) => {
    if (code === locale) return;
    haptic.success();
    setLocale(code);
    const lang = LANG_MAP.get(code);
    // Le toast est formulé dans la nouvelle langue.
    if (lang) toast(`${translate('settings.lang.activated', undefined, code)} : ${lang.flag} ${lang.native}`);
  };

  const header = (
    <View style={styles.header}>
      <View style={[styles.search, { backgroundColor: colors.container }]}>
        <Search size={18} color={colors.inkFaint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('settings.lang.search')}
          placeholderTextColor={colors.inkFaint}
          selectionColor={colors.primary}
          autoCapitalize="none"
          style={[typography.body, styles.flex, { color: colors.ink }]}
        />
      </View>
      {!search && filter === 'all' ? (
        <Animated.View entering={FadeIn} style={styles.featured}>
          <View style={styles.inline}>
            <Text variant="smallStrong" style={styles.flex}>
              {t('settings.lang.instant')}
            </Text>
            <Text variant="caption" tone="faint">
              {FEATURED.length}
            </Text>
          </View>
          <View style={styles.grid}>
            {FEATURED.map((lang) => (
              <FeaturedTile key={lang.code} lang={lang} active={lang.code === locale} onPress={() => choose(lang.code)} />
            ))}
          </View>
          <Text variant="smallStrong" style={styles.allTitle}>
            {t('settings.lang.filter_all')}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title={t('settings.lang.title')} back />
      <Chips
        options={[
          { value: 'all' as const, label: t('settings.lang.all_tab') },
          { value: 'african' as const, label: t('settings.lang.african') },
          { value: 'international' as const, label: t('settings.lang.international') },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <FlatList
        data={filtered}
        keyExtractor={(lang) => lang.code}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <AppearItem index={index}>
            <LanguageRow lang={item} active={item.code === locale} onPress={() => choose(item.code)} />
          </AppearItem>
        )}
        ListEmptyComponent={
          <Text tone="muted" style={styles.empty}>
            {t('lang.none')}
          </Text>
        }
        ListFooterComponent={
          <Text variant="caption" tone="faint" style={styles.note}>
            {t('lang.fallback_note')}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  header: { padding: 16, gap: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: radius.pill, paddingHorizontal: 14 },
  featured: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31%', flexGrow: 1, padding: 10, gap: 2, borderRadius: radius.md, borderWidth: 1.5 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  flag: { fontSize: 22, lineHeight: 28 },
  check: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  allTitle: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  empty: { textAlign: 'center', padding: 32 },
  note: { textAlign: 'center', paddingHorizontal: 32, paddingVertical: 24 },
});
