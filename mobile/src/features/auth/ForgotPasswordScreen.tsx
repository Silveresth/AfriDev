import { router } from 'expo-router';
import { AtSign, Hash, KeyRound, Lock, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, errorMessage, unwrap } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { haptic } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { Button, Header, Text, TextField, useToast } from '@/shared/ui';

/**
 * Mot de passe oublié, entièrement dans l'appli :
 * 1. l'e-mail du compte → l'API envoie un code à 6 chiffres (valable 15 minutes) ;
 * 2. le code + le nouveau mot de passe → mot de passe changé et connexion directe.
 * La première réponse est la même que l'adresse existe ou non (rien ne révèle un compte).
 */
export function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const { signIn } = useSession();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'email' | 'code' | 'mfa'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cleanEmail = email.trim();
  const emailValid = /^\S+@\S+\.\S+$/.test(cleanEmail);
  const resetValid = /^\d{6}$/.test(code) && password.length >= 8;

  const requestCode = async (resend = false) => {
    if (!emailValid || loading) return;
    setError(null);
    setLoading(true);
    try {
      await unwrap(api.POST('/api/accounts/password/reset/', { body: { email: cleanEmail } }));
      if (resend) toast(t('forgot.resent'));
      setStep('code');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (!resetValid || loading) return;
    setError(null);
    setLoading(true);
    try {
      const response = await unwrap(
        api.POST('/api/accounts/password/reset/code/', { body: { email: cleanEmail, code, password } }),
      );
      haptic.success();
      if (response.tokens) signIn(response.tokens); // la session ouverte bascule vers l'accueil
      else setStep('mfa'); // double authentification active : connexion avec le code de l'appli
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const Icon = step === 'email' ? KeyRound : step === 'code' ? Lock : ShieldCheck;
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title="" back />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon size={26} color={colors.primaryInk} />
        </View>
        <Text variant="title">{t(step === 'email' ? 'forgot.title' : 'forgot.sent_title')}</Text>

        {step === 'email' ? (
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
              onSubmitEditing={() => void requestCode()}
              error={error}
              autoFocus
            />
            <Button label={t('forgot.send')} block disabled={!emailValid} loading={loading} onPress={() => void requestCode()} />
            <Text variant="small" tone="faint" style={styles.center}>
              {t('forgot.oauth_hint')}
            </Text>
          </>
        ) : step === 'code' ? (
          <>
            <Text tone="muted">{t('forgot.sent_body', { email: cleanEmail })}</Text>
            <TextField
              label={t('forgot.code')}
              icon={Hash}
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
            />
            <TextField
              label={t('forgot.new_password')}
              icon={Lock}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              hint={t('forgot.password_hint')}
              returnKeyType="done"
              onSubmitEditing={() => void reset()}
              error={error}
            />
            <Button label={t('forgot.reset')} block disabled={!resetValid} loading={loading} onPress={() => void reset()} />
            <View style={styles.row}>
              <Button label={t('forgot.resend')} variant="ghost" size="sm" disabled={loading} onPress={() => void requestCode(true)} />
              <Button
                label={t('forgot.other_email')}
                variant="ghost"
                size="sm"
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                }}
              />
            </View>
          </>
        ) : (
          <>
            <Text tone="muted">{t('forgot.done_mfa')}</Text>
            <Button label={t('auth.login')} block onPress={() => router.replace('/login')} />
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
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
