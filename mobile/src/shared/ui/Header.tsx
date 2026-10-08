import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';

import { IconButton } from './Button';
import { BackArrow } from './icons';
import { Text } from './Text';

/**
 * En-tête d'écran : titre aligné à gauche (onglets) ou centré avec retour (écrans empilés).
 * Un filet fin le sépare du contenu, aucune ombre.
 */
export function Header({
  title,
  back,
  close,
  right,
  large,
}: {
  title?: string;
  back?: boolean;
  close?: boolean;
  right?: React.ReactNode;
  /** Titre d'onglet, plus grand, aligné à gauche. */
  large?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/feed'));

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.line },
      ]}
    >
      <View style={styles.inner}>
        {back || close ? (
          <IconButton icon={close ? X : BackArrow} label={t(close ? 'header.close' : 'header.back')} onPress={leave} />
        ) : null}
        <Text
          variant={large ? 'title' : 'headline'}
          numberOfLines={1}
          style={[styles.title, large ? styles.large : null, back || close ? null : styles.flush]}
        >
          {title}
        </Text>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  inner: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 },
  title: { flex: 1 },
  large: { fontSize: 22, lineHeight: 28 },
  flush: { paddingLeft: 8 },
  right: { flexDirection: 'row', alignItems: 'center' },
});
