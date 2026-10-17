import { useMutation } from '@tanstack/react-query';
import { AtSign, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError, errorMessage, PUBLIC_WEB_URL, unwrap } from '@/shared/api';
import { BrandTile } from '@/shared/brand';
import { type Key, useT } from '@/shared/i18n';
import { openLink } from '@/shared/lib';
import { haptic, Shake } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { mono, radius, useTheme } from '@/shared/theme';
import { Button, Text, TextField } from '@/shared/ui';

import {
  type AuthResponse,
  OAuthCancelled,
  type OAuthProvider,
  PROVIDER_LABELS,
  passwordStrength,
  signInWithProvider,
  useOAuthProviders,
  useUsernameStatus,
} from './api';
import { GitHubLogo, GoogleLogo } from './ProviderLogos';

type Mode = 'login' | 'register';

const USERNAME = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Onglets « Se connecter / Créer un compte », comme sur le site. */
function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={[styles.switch, { backgroundColor: colors.container }]} accessibilityRole="tablist">
      {(['login', 'register'] as const).map((value) => {
        const active = mode === value;
        return (
          <Pressable
            key={value}
            onPress={() => {
              if (!active) haptic.select();
              onChange(value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.switchItem, active && { backgroundColor: colors.background }]}
          >
            <Text variant="smallStrong" tone={active ? 'ink' : 'muted'}>
              {t(value === 'login' ? 'auth.login' : 'auth.create_account')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Jauge de solidité du mot de passe : quatre segments. */
function StrengthMeter({ password }: { password: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const score = passwordStrength(password);
  const tint = [colors.lineStrong, colors.danger, colors.tertiary, colors.secondary, colors.secondary][score] ?? colors.lineStrong;
  return (
    <View style={styles.meter}>
      <View style={styles.segments}>
        {[1, 2, 3, 4].map((step) => (
          <View key={step} style={[styles.segment, { backgroundColor: score >= step ? tint : colors.container }]} />
        ))}
      </View>
      <Text variant="caption" style={{ color: tint }}>
        {t(`login.strength.${score}` as Key)}
      </Text>
    </View>
  );
}

/** Code à 6 chiffres (double authentification) : un champ invisible, six cases. */
function CodeInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete: () => void }) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  return (
    <Pressable onPress={() => input.current?.focus()} style={styles.codeRow}>
      {Array.from({ length: 6 }, (_, i) => {
        const char = value[i];
        const active = i === Math.min(value.length, 5);
        return (
          <View
            key={i}
            style={[styles.codeCell, { borderColor: active ? colors.primary : char ? colors.ink : colors.lineStrong, backgroundColor: colors.surface }]}
          >
            {char ? <Text style={[styles.codeChar, { color: colors.ink }]}>{char}</Text> : null}
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '').slice(0, 6);
          onChange(digits);
          if (digits.length === 6) onComplete();
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

function fieldError(error: unknown, field: string): string | null {
  if (!(error instanceof ApiError)) return null;
  const value = error.details[field];
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null;
}

/**
 * Connexion / inscription, identiques au site : Google et GitHub, puis e-mail + mot de passe ;
 * code de double authentification si le compte l'a activée. L'écran tient sans défilement.
 */
export function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const providers = useOAuthProviders();

  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [shakes, setShakes] = useState(0);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const usernameStatus = useUsernameStatus(mode === 'register' ? username : '');

  // Nouveau compte : l'accueil s'ouvre de lui-même après la connexion (needs_onboarding).
  const finish = (response: AuthResponse) => {
    if (response.mfa_required && response.mfa_token) {
      setMfaToken(response.mfa_token);
      return;
    }
    if (response.tokens) {
      haptic.success();
      signIn(response.tokens);
    }
  };

  const fail = () => {
    haptic.error();
    setShakes((n) => n + 1);
  };

  const submit = useMutation({
    mutationFn: async (): Promise<AuthResponse> => {
      if (mfaToken) return unwrap(api.POST('/api/accounts/login/2fa/', { body: { mfa_token: mfaToken, code } }));
      if (mode === 'login') {
        return unwrap(api.POST('/api/accounts/login/', { body: { identifier: identifier.trim(), password } }));
      }
      return unwrap(
        api.POST('/api/accounts/register/', {
          body: { username: username.trim(), email: email.trim().toLowerCase(), password },
        }),
      );
    },
    onSuccess: finish,
    onError: fail,
  });

  const oauth = useMutation({
    mutationFn: (provider: OAuthProvider) => signInWithProvider(provider),
    onMutate: (provider) => setPendingProvider(provider),
    onSettled: () => setPendingProvider(null),
    onSuccess: finish,
    onError: (error) => {
      if (!(error instanceof OAuthCancelled)) fail();
    },
  });

  // Google et GitHub toujours proposés ; s'ils ne sont pas encore activés sur le serveur,
  // le toucher l'explique au lieu de masquer les boutons.
  const startOAuth = (provider: OAuthProvider) => {
    submit.reset();
    if (providers.isSuccess && !providers.data.includes(provider)) {
      setNotice(t('login.provider_off', { provider: PROVIDER_LABELS[provider] }));
      return;
    }
    setNotice(null);
    oauth.mutate(provider);
  };

  // Contrôles locaux, affichés après la première tentative (pas pendant la frappe).
  const clientErrors: Record<string, string | null> =
    mode === 'register'
      ? {
          username: USERNAME.test(username.trim()) ? null : t('login.err_username'),
          email: EMAIL.test(email.trim()) ? null : t('login.err_email'),
          password: password.length >= 8 ? null : t('login.err_password_len'),
        }
      : {
          identifier: identifier.trim() ? null : t('login.err_identifier'),
          password: password ? null : t('login.err_password'),
        };
  const valid = Object.values(clientErrors).every((value) => !value);
  const serverField = (key: string) => fieldError(submit.error, key);
  const shown = (key: string) => (submitted ? clientErrors[key] : null) ?? serverField(key);
  const hasFieldError = ['username', 'email', 'password', 'identifier'].some((key) => serverField(key));

  const onSubmit = () => {
    setSubmitted(true);
    setNotice(null);
    if (!valid) {
      fail();
      return;
    }
    submit.mutate();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setSubmitted(false);
    setNotice(null);
    submit.reset();
  };

  const banner =
    notice ??
    (oauth.isError && !(oauth.error instanceof OAuthCancelled) ? errorMessage(oauth.error) : null) ??
    (submit.isError && !hasFieldError ? errorMessage(submit.error) : null);

  const eye = (
    <Pressable hitSlop={10} onPress={() => setShowPassword((v) => !v)} accessibilityLabel={t(showPassword ? 'auth.password_hide' : 'auth.password_show')}>
      {showPassword ? <EyeOff size={18} color={colors.inkMuted} /> : <Eye size={18} color={colors.inkMuted} />}
    </Pressable>
  );

  const usernameHint =
    usernameStatus?.data?.available === true ? `✓ ${t('login.username_free')}` : usernameStatus?.data ? usernameStatus.data.reason : t('login.username_hint');
  const githubTone = isDark ? { bg: '#F0F0F2', fg: '#0A0A0B', border: '#F0F0F2' } : { bg: '#0D1117', fg: '#FFFFFF', border: '#0D1117' };
  const googleTone = { bg: colors.background, fg: colors.ink, border: colors.lineStrong };

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Centré et sans rebond : ne défile que si le clavier ne laisse plus la place. */}
      <ScrollView
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      >
        <View style={styles.hero}>
          <BrandTile size={48} />
          <Text variant="title">
            {t(mfaToken ? 'login.title_mfa' : mode === 'login' ? 'login.title_login' : 'login.title_register')}
          </Text>
          <Text variant="small" tone="muted">
            {t(mfaToken ? 'login.sub_mfa' : mode === 'login' ? 'login.sub_login' : 'login.sub_register')}
          </Text>
        </View>

        {mfaToken ? (
          <Animated.View entering={FadeIn.duration(180)} style={styles.form}>
            <View style={[styles.mfaBadge, { backgroundColor: colors.secondarySoft }]}>
              <ShieldCheck size={18} color={colors.secondaryInk} />
              <Text variant="small" tone="secondary">
                {t('login.mfa_badge')}
              </Text>
            </View>
            <Shake trigger={shakes}>
              <CodeInput value={code} onChange={setCode} onComplete={() => setTimeout(() => submit.mutate(), 50)} />
            </Shake>
            {submit.isError ? (
              <Text variant="small" tone="danger" style={styles.center}>
                {errorMessage(submit.error)}
              </Text>
            ) : null}
            <Button label={t('login.verify')} block disabled={code.length !== 6} loading={submit.isPending} onPress={() => submit.mutate()} />
            <Button
              label={t('common.back')}
              variant="ghost"
              onPress={() => {
                setMfaToken(null);
                setCode('');
                submit.reset();
              }}
            />
          </Animated.View>
        ) : (
          <View style={styles.form}>
            <ModeSwitch mode={mode} onChange={switchMode} />

            <View style={styles.oauth}>
              <View style={styles.flex}>
                <Button
                  label="Google"
                  tone={googleTone}
                  block
                  size="sm"
                  leading={<GoogleLogo size={18} />}
                  loading={pendingProvider === 'google'}
                  disabled={Boolean(pendingProvider) && pendingProvider !== 'google'}
                  onPress={() => startOAuth('google')}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="GitHub"
                  tone={githubTone}
                  block
                  size="sm"
                  leading={<GitHubLogo size={18} color={githubTone.fg} />}
                  loading={pendingProvider === 'github'}
                  disabled={Boolean(pendingProvider) && pendingProvider !== 'github'}
                  onPress={() => startOAuth('github')}
                />
              </View>
            </View>
            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: colors.line }]} />
              <Text variant="caption" tone="faint">
                {t('login.or_email')}
              </Text>
              <View style={[styles.line, { backgroundColor: colors.line }]} />
            </View>

            <Shake trigger={shakes}>
              <View style={styles.fields}>
                {mode === 'login' ? (
                  <TextField
                    label={t('auth.email_or_username')}
                    icon={AtSign}
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder={t('login.identifier_ph')}
                    autoCapitalize="none"
                    autoComplete="username"
                    textContentType="username"
                    keyboardType="email-address"
                    returnKeyType="next"
                    error={shown('identifier')}
                  />
                ) : (
                  <>
                    <TextField
                      label={t('auth.username')}
                      icon={AtSign}
                      value={username}
                      onChangeText={(value) => setUsername(value.replace(/\s/g, '_'))}
                      placeholder="amina_dev"
                      autoCapitalize="none"
                      autoComplete="username-new"
                      hint={usernameHint}
                      error={shown('username') ?? (usernameStatus?.data?.available === false ? usernameStatus.data.reason : null)}
                      trailing={
                        usernameStatus?.data?.suggestion ? (
                          <Pressable hitSlop={8} onPress={() => setUsername(usernameStatus.data?.suggestion ?? username)}>
                            <Text variant="caption" tone="primary">
                              {t('login.username_take', { name: usernameStatus.data.suggestion })}
                            </Text>
                          </Pressable>
                        ) : undefined
                      }
                    />
                    <TextField
                      label={t('login.email')}
                      icon={Mail}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="amina@exemple.com"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      error={shown('email')}
                    />
                  </>
                )}
                <TextField
                  label={t('auth.password')}
                  icon={Lock}
                  trailing={eye}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'login' ? '••••••••' : t('login.password_ph')}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  textContentType={mode === 'login' ? 'password' : 'newPassword'}
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                  error={shown('password')}
                />
                {mode === 'register' && password ? <StrengthMeter password={password} /> : null}
                {mode === 'login' ? (
                  <Pressable onPress={() => void openLink(`${PUBLIC_WEB_URL}/forgot-password`)} style={styles.forgot} hitSlop={8}>
                    <Text variant="small" tone="primary">
                      {t('login.forgot')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Shake>

            {banner ? (
              <View style={[styles.banner, { backgroundColor: colors.dangerSoft }]}>
                <Text variant="small" tone="danger">
                  {banner}
                </Text>
              </View>
            ) : null}

            <Button
              label={t(mode === 'login' ? 'auth.login' : 'login.submit_register')}
              block
              loading={submit.isPending}
              disabled={Boolean(pendingProvider)}
              onPress={onSubmit}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  hero: { gap: 6 },
  form: { gap: 14 },
  fields: { gap: 12 },
  oauth: { flexDirection: 'row', gap: 10 },
  switch: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, height: 44 },
  switchItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  banner: { padding: 12, borderRadius: radius.md },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4 },
  segments: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  mfaBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  codeCell: { flex: 1, height: 56, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  codeChar: { fontSize: 24, fontWeight: '700', fontFamily: mono },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  center: { textAlign: 'center' },
  forgot: { alignSelf: 'flex-end', marginTop: -4 },
});
