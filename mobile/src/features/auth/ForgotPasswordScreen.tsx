import { router } from 'expo-router';
import { AtSign, KeyRound, MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, errorMessage, unwrap } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { haptic } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';
import { Button, Header, Text, TextField } from '@/shared/ui';

/**
 * Mot de passe oublié, en écran natif (auparavant la page du site dans le navigateur interne).
 * La réponse est la même que l'adresse existe ou non : rien ne révèle si un compte existe.
 */
export function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = async () => {
    if (!valid || loading) return;
    setError(null);
    setLoading(true);
    try {
      await unwrap(api.POST('/api/accounts/password/reset/', { body: { email: email.trim() } }));
      haptic.success();
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const Icon = sent ? MailCheck : KeyRound;
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title="" back />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon size={26} color={colors.primaryInk} />
        </View>
        <Text variant="title">{t(sent ? 'forgot.sent_title' : 'forgot.title')}</Text>
        {sent ? (
          <>
            <Text tone="muted">{t('forgot.sent_body', { email: email.trim() })}</Text>
            <Button label={t('common.back')} block onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))} />
          </>
        ) : (
          <>
            <Text tone="muted">{t('forgot.body')}</Text>
            <TextField
              label={t('login.email')}
              icon={AtSign}
              value={email}
              onChangeText={setEmail}
              placeholder="amina@exemple.com"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={() => void submit()}
              error={error}
              autoFocus
            />
            <Button label={t('forgot.send')} block disabled={!valid} loading={loading} onPress={() => void submit()} />
            <Text variant="small" tone="faint" style={styles.center}>
              {t('forgot.oauth_hint')}
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, gap: 16 },
  icon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
