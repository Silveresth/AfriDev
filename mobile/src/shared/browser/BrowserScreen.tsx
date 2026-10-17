import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { ArrowLeft, ArrowRight, RotateCw, Share2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { useT } from '@/shared/i18n';
import { domainOf, resolveInternalRoute } from '@/shared/lib';
import { useTheme } from '@/shared/theme';
import { IconButton, Text } from '@/shared/ui';

/**
 * Navigateur interne : les liens externes s'ouvrent dans l'appli (aucun passage par Chrome ou
 * Safari). Une page AfriDev rouvre l'écran natif ; mailto:, tel:, intent: vont à l'appli dédiée.
 */
export function BrowserScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const web = useRef<WebView>(null);
  const [state, setState] = useState({ title: '', url: url ?? '', canGoBack: false, canGoForward: false });
  const [progress, setProgress] = useState(0);

  // Retour Android : page précédente dans le navigateur, puis fermeture.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state.canGoBack) {
        web.current?.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [state.canGoBack]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onNavigation = (nav: WebViewNavigation) =>
    setState({ title: nav.title, url: nav.url, canGoBack: nav.canGoBack, canGoForward: nav.canGoForward });

  const shouldLoad = ({ url: next }: { url: string }) => {
    if (/^https?:/i.test(next) || next === 'about:blank') {
      const route = resolveInternalRoute(next);
      if (route && next !== url) {
        router.replace(route as never);
        return false;
      }
      return true;
    }
    void Linking.openURL(next).catch(() => undefined);
    return false;
  };

  if (!url) return null;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.bar, { borderBottomColor: colors.line }]}>
        <IconButton icon={X} label={t('header.close')} onPress={close} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {state.title || domainOf(state.url)}
          </Text>
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {domainOf(state.url)}
          </Text>
        </View>
        <IconButton icon={RotateCw} label={t('browser.reload')} size={19} onPress={() => web.current?.reload()} />
        <IconButton icon={Share2} label={t('feed.share')} size={19} onPress={() => void Share.share({ message: state.url })} />
      </View>
      {progress < 1 ? (
        <View style={[styles.progressTrack, { backgroundColor: colors.container }]}>
          <View style={[styles.progress, { width: `${Math.max(progress, 0.05) * 100}%`, backgroundColor: colors.primary }]} />
        </View>
      ) : null}
      <WebView
        ref={web}
        source={{ uri: url }}
        style={styles.flex}
        onNavigationStateChange={onNavigation}
        onShouldStartLoadWithRequest={shouldLoad}
        onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        pullToRefreshEnabled
        decelerationRate="normal"
      />
      {state.canGoBack || state.canGoForward ? (
        <View style={[styles.nav, { borderTopColor: colors.line, paddingBottom: insets.bottom + 4, backgroundColor: colors.background }]}>
          <IconButton icon={ArrowLeft} label={t('header.back')} onPress={() => web.current?.goBack()} color={state.canGoBack ? colors.ink : colors.inkFaint} />
          <IconButton icon={ArrowRight} label={t('browser.forward')} onPress={() => web.current?.goForward()} color={state.canGoForward ? colors.ink : colors.inkFaint} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  progressTrack: { height: 2 },
  progress: { height: 2 },
  nav: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
});
