import { Redirect, router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { ArrowLeft, ArrowRight, CloudOff, ExternalLink, RotateCw, Share2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { useT } from '@/shared/i18n';
import { domainOf, goToRoute, resolveInternalRoute } from '@/shared/lib';
import { useTheme } from '@/shared/theme';
import { Button, IconButton, Text } from '@/shared/ui';

const LOAD_TIMEOUT_MS = 20_000;

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
  // Jamais d'écran vide (noir ou blanc selon le thème) : chargement visible, puis erreur avec
  // solution de repli si la page échoue ou n'a rien affiché au bout de 20 secondes.
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loaded || failed) return;
    const timer = setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loaded, failed, attempt]);

  const retry = () => {
    setFailed(false);
    setLoaded(false);
    setProgress(0);
    setAttempt((value) => value + 1);
  };
  const openExternal = () => void Linking.openURL(state.url || url || '').catch(() => undefined);

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
        goToRoute(route, { replace: true });
        return false;
      }
      return true;
    }
    void Linking.openURL(next).catch(() => undefined);
    return false;
  };

  // Ouvert sans adresse (redirection de navigation, lien cassé) : jamais d'écran vide.
  if (!url) return <Redirect href="/" />;

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
      {failed ? (
        <View style={[styles.flex, styles.center]}>
          <View style={[styles.errorIcon, { backgroundColor: colors.container }]}>
            <CloudOff size={26} color={colors.inkMuted} />
          </View>
          <Text variant="headline" style={styles.centerText}>
            {t('browser.error_title')}
          </Text>
          <Text tone="muted" style={styles.centerText}>
            {t('browser.error_body')}
          </Text>
          <Button label={t('common.retry')} onPress={retry} />
          <Button label={t('browser.open_external')} variant="ghost" icon={ExternalLink} onPress={openExternal} />
        </View>
      ) : (
      <View style={styles.flex}>
      <WebView
        key={attempt}
        ref={web}
        source={{ uri: url }}
        style={[styles.flex, { backgroundColor: colors.background }]}
        onNavigationStateChange={onNavigation}
        onShouldStartLoadWithRequest={shouldLoad}
        onLoadProgress={({ nativeEvent }) => {
          setProgress(nativeEvent.progress);
          if (nativeEvent.progress >= 0.7) setLoaded(true); // contenu déjà affiché
        }}
        onLoadEnd={() => setLoaded(true)}
        onError={() => setFailed(true)}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.statusCode >= 500) setFailed(true);
        }}
        onRenderProcessGone={() => setFailed(true)}
        onContentProcessDidTerminate={() => web.current?.reload()}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        pullToRefreshEnabled
        decelerationRate="normal"
      />
      {!loaded ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      </View>
      )}
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
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  centerText: { textAlign: 'center', maxWidth: 300 },
  errorIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
