import { useMutation } from '@tanstack/react-query';
import { joinPhone, PHONE_COUNTRIES } from '@afridev/validation';
import { AtSign, Eye, EyeOff, Lock, Mail, ShieldCheck, Smartphone, UserRound } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError, errorMessage, PUBLIC_WEB_URL, unwrap } from '@/shared/api';
import { openLink } from '@/shared/lib';
import { type Key, useT } from '@/shared/i18n';
import { BrandTile } from '@/shared/brand';
import { haptic, Shake, SOFT_SPRING } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { mono, radius, useTheme } from '@/shared/theme';
import { Button, Text, TextField } from '@/shared/ui';

import {
  type AuthResponse,
  OAuthCancelled,
  type OAuthProvider,
  passwordStrength,
  signInWithProvider,
  useOAuthProviders,
  useUsernameStatus,
} from './api';
import { GitHubLogo, GoogleLogo } from './ProviderLogos';

type Mode = 'login' | 'register';
type Method = 'email' | 'phone';
const RESEND_AFTER = 45;

const USERNAME = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Sélecteur « Se connecter / Créer un compte » : l'onglet actif glisse sous le libellé. */
function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(mode === 'login' ? 0 : 1);
  useEffect(() => {
    x.value = withSpring(mode === 'login' ? 0 : 1, SOFT_SPRING);
  }, [mode, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (width / 2 - 4) }] }));

  return (
    <View style={[styles.switch, { backgroundColor: colors.container }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width ? <Animated.View style={[styles.switchPill, { width: width / 2 - 4, backgroundColor: colors.background }, pill]} /> : null}
      {(['login', 'register'] as const).map((value) => (
        <Pressable
          key={value}
          onPress={() => {
            if (value !== mode) haptic.select();
            onChange(value);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === value }}
          style={styles.switchItem}
        >
          <Text variant="smallStrong" tone={mode === value ? 'ink' : 'muted'}>
            {t(value === 'login' ? 'auth.login' : 'auth.create_account')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Jauge de solidité du mot de passe : quatre segments qui se remplissent. */
function StrengthMeter({ password }: { password: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const score = passwordStrength(password);
  const tint = [colors.lineStrong, colors.danger, colors.tertiary, colors.secondary, colors.secondary][score];
  return (
    <Animated.View entering={FadeIn} style={styles.meter}>
      <View style={styles.segments}>
        {[1, 2, 3, 4].map((step) => (
          <Segment key={step} on={score >= step} color={tint ?? colors.lineStrong} />
        ))}
      </View>
      <Text variant="caption" style={{ color: tint }}>
        {t(`login.strength.${score}` as Key)}
      </Text>
    </Animated.View>
  );
}

function Segment({ on, color }: { on: boolean; color: string }) {
  const { colors } = useTheme();
  const fill = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(on ? 1 : 0, { duration: 260 });
  }, [fill, on]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View style={[styles.segment, { backgroundColor: colors.container }]}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: color }, style]} />
    </View>
  );
}

/** Code à 6 chiffres : un champ invisible, six cases qui s'illuminent au fil de la saisie. */
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
            {char ? (
              <Animated.Text entering={ZoomIn.springify().damping(12)} style={[styles.codeChar, { color: colors.ink }]}>
                {char}
              </Animated.Text>
            ) : null}
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

/** Choix de l'indicatif : liste déroulante compacte (les pays d'Afrique francophone d'abord). */
function CountryPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = PHONE_COUNTRIES.find((country) => country.code === value) ?? PHONE_COUNTRIES[0];
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={current.name}
        style={[styles.country, { borderColor: colors.lineStrong, backgroundColor: colors.surface }]}
      >
        <Text>
          {current.flag} {current.code}
        </Text>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(150)} style={[styles.countryList, { borderColor: colors.line, backgroundColor: colors.background }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {PHONE_COUNTRIES.map((country) => (
              <Pressable
                key={country.code + country.label}
                onPress={() => {
                  haptic.select();
                  onChange(country.code);
                  setOpen(false);
                }}
                style={styles.countryItem}
              >
                <Text variant="small">
                  {country.flag} {country.name} <Text variant="small" tone="muted">{country.code}</Text>
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Connexion, inscription, GitHub / Google, SMS, puis code de double authentification si activée. */
export function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const providers = useOAuthProviders();

  const [mode, setMode] = useState<Mode>('login');
  const [method, setMethod] = useState<Method>('email');
  const [country, setCountry] = useState<string>(PHONE_COUNTRIES[0].code);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [identifier, setIdentifier] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [shakes, setShakes] = useState(0);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
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

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const requestCode = useMutation({
    mutationFn: (phone: string) => unwrap(api.POST('/api/accounts/otp/request/', { body: { phone_number: phone } })),
    onSuccess: (data) => {
      setOtpPhone(data.phone_number);
      setOtp('');
      setResendIn(RESEND_AFTER);
    },
    onError: () => {
      haptic.error();
      setShakes((n) => n + 1);
    },
  });

  const verifyCode = useMutation({
    mutationFn: () => unwrap(api.POST('/api/accounts/otp/verify/', { body: { phone_number: otpPhone ?? '', code: otp } })),
    onSuccess: finish,
    onError: () => {
      haptic.error();
      setShakes((n) => n + 1);
      setOtp('');
    },
  });

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
          body: {
            username: username.trim(),
            email: email.trim().toLowerCase(),
            password,
            ...(displayName.trim() ? { display_name: displayName.trim() } : {}),
          },
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

  // Seuls les fournisseurs réellement configurés sur le serveur sont proposés.
  const configured = providers.data ?? [];
  const startOAuth = (provider: OAuthProvider) => {
    submit.reset();
    setLocalError(null);
    oauth.mutate(provider);
  };

  // Contrôles locaux, affichés après la première tentative (on ne gronde pas pendant la frappe).
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
    setLocalError(null);
    if (!valid) {
      fail();
      return;
    }
    submit.mutate();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setSubmitted(false);
    submit.reset();
    setLocalError(null);
  };

  const banner =
    localError ??
    (oauth.isError && !(oauth.error instanceof OAuthCancelled) ? errorMessage(oauth.error) : null) ??
    (submit.isError && !hasFieldError ? errorMessage(submit.error) : null);

  const eye = (
    <Pressable hitSlop={10} onPress={() => setShowPassword((v) => !v)} accessibilityLabel={t(showPassword ? 'auth.password_hide' : 'auth.password_show')}>
      {showPassword ? <EyeOff size={18} color={colors.inkMuted} /> : <Eye size={18} color={colors.inkMuted} />}
    </Pressable>
  );

  const title = t(
    mfaToken ? 'login.title_mfa' : otpPhone ? 'login.title_otp' : mode === 'login' ? 'login.title_login' : 'login.title_register',
  );
  const subtitle = mfaToken
    ? t('login.sub_mfa')
    : otpPhone
      ? t('login.sub_otp', { phone: otpPhone })
      : t(mode === 'login' ? 'login.sub_login' : 'login.sub_register');
  const usernameHint =
    usernameStatus?.data?.available === true
      ? `✓ ${t('login.username_free')}`
      : usernameStatus?.data
        ? usernameStatus.data.reason
        : t('login.username_hint');

  const githubTone = isDark
    ? { bg: '#F0F0F2', fg: '#0A0A0B', border: '#F0F0F2' }
    : { bg: '#0D1117', fg: '#FFFFFF', border: '#0D1117' };
  const googleTone = { bg: colors.background, fg: colors.ink, border: colors.lineStrong };

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <BrandTile size={60} />
        </Animated.View>

        <Animated.View key={title} entering={FadeInDown.duration(320)} exiting={FadeOutUp.duration(160)} style={styles.hero}>
          <Text variant="display">{title}</Text>
          <Text tone="muted">{subtitle}</Text>
        </Animated.View>

        {otpPhone && !mfaToken ? (
          <Animated.View entering={FadeInDown.duration(320)} style={styles.form}>
            <Shake trigger={shakes}>
              <CodeInput value={otp} onChange={setOtp} onComplete={() => setTimeout(() => verifyCode.mutate(), 50)} />
            </Shake>
            {verifyCode.isError ? (
              <Text variant="small" tone="danger" style={styles.center}>
                {errorMessage(verifyCode.error)}
              </Text>
            ) : null}
            <Button label={t('login.verify')} block disabled={otp.length !== 6} loading={verifyCode.isPending} onPress={() => verifyCode.mutate()} />
            <Button
              label={resendIn > 0 ? t('login.resend_in', { seconds: resendIn }) : t('login.resend')}
              variant="secondary"
              disabled={resendIn > 0}
              loading={requestCode.isPending}
              onPress={() => requestCode.mutate(otpPhone)}
            />
            <Button
              label={t('common.back')}
              variant="ghost"
              onPress={() => {
                setOtpPhone(null);
                verifyCode.reset();
              }}
            />
          </Animated.View>
        ) : mfaToken ? (
          <Animated.View entering={FadeInDown.duration(320)} style={styles.form}>
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
          <Animated.View layout={LinearTransition.springify().damping(18)} style={styles.form}>
            <ModeSwitch mode={mode} onChange={switchMode} />

            {configured.length ? (
              <>
                <View style={styles.oauth}>
                  {configured.includes('google') ? (
                    <Button
                      label={t('login.google')}
                      tone={googleTone}
                      block
                      leading={<GoogleLogo />}
                      loading={pendingProvider === 'google'}
                      disabled={Boolean(pendingProvider) && pendingProvider !== 'google'}
                      onPress={() => startOAuth('google')}
                    />
                  ) : null}
                  {configured.includes('github') ? (
                    <Button
                      label={t('login.github')}
                      tone={githubTone}
                      block
                      leading={<GitHubLogo color={githubTone.fg} />}
                      loading={pendingProvider === 'github'}
                      disabled={Boolean(pendingProvider) && pendingProvider !== 'github'}
                      onPress={() => startOAuth('github')}
                    />
                  ) : null}
                </View>
                <View style={styles.divider}>
                  <View style={[styles.line, { backgroundColor: colors.line }]} />
                  <Text variant="caption" tone="faint">
                    {t('login.or')}
                  </Text>
                  <View style={[styles.line, { backgroundColor: colors.line }]} />
                </View>
              </>
            ) : null}

            <View style={styles.methods} accessibilityRole="radiogroup">
              {(
                [
                  ['email', 'login.method_email', Mail],
                  ['phone', 'login.method_phone', Smartphone],
                ] as const
              ).map(([value, label, Icon]) => {
                const active = method === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      haptic.select();
                      setMethod(value);
                      setLocalError(null);
                    }}
                    style={[styles.method, { borderColor: active ? colors.primary : colors.line, backgroundColor: active ? colors.primarySoft : 'transparent' }]}
                  >
                    <Icon size={16} color={active ? colors.primaryInk : colors.inkMuted} />
                    <Text variant="smallStrong" tone={active ? 'ink' : 'muted'}>
                      {t(label)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {method === 'phone' ? (
              <Shake trigger={shakes}>
                <View style={styles.fields}>
                  <Text variant="smallStrong">{t('login.phone')}</Text>
                  <View style={styles.phoneRow}>
                    <CountryPicker value={country} onChange={setCountry} />
                    <View style={styles.flex}>
                      <TextField
                        icon={Smartphone}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="90 12 34 56"
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                        returnKeyType="send"
                        onSubmitEditing={() => requestCode.mutate(joinPhone(country, phoneNumber))}
                      />
                    </View>
                  </View>
                  <Text variant="caption" tone="faint">
                    {t('login.phone_hint')}
                  </Text>
                  {requestCode.isError ? (
                    <Text variant="small" tone="danger">
                      {errorMessage(requestCode.error)}
                    </Text>
                  ) : null}
                  <Button
                    label={t('login.send_code')}
                    block
                    loading={requestCode.isPending}
                    disabled={phoneNumber.replace(/\D/g, '').length < 6}
                    onPress={() => requestCode.mutate(joinPhone(country, phoneNumber))}
                  />
                </View>
              </Shake>
            ) : (
            <>
            <Shake trigger={shakes}>
              <Animated.View key={mode} entering={FadeIn.duration(260)} exiting={FadeOut.duration(120)} style={styles.fields}>
                {mode === 'login' ? (
                  <>
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
                    <TextField
                      label={t('auth.password')}
                      icon={Lock}
                      trailing={eye}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      secureTextEntry={!showPassword}
                      autoComplete="current-password"
                      textContentType="password"
                      returnKeyType="go"
                      onSubmitEditing={onSubmit}
                      error={shown('password')}
                    />
                    <Pressable onPress={() => void openLink(`${PUBLIC_WEB_URL}/forgot-password`)} style={styles.forgot} hitSlop={8}>
                      <Text variant="small" tone="primary">
                        {t('login.forgot')}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <TextField
                      label={t('login.display_name')}
                      icon={UserRound}
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder="Amina Diallo"
                      autoComplete="name"
                      textContentType="name"
                    />
                    <TextField
                      label={t('auth.username')}
                      icon={AtSign}
                      value={username}
                      onChangeText={setUsername}
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
                    <TextField
                      label={t('auth.password')}
                      icon={Lock}
                      trailing={eye}
                      value={password}
                      onChangeText={setPassword}
                      placeholder={t('login.password_ph')}
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      error={shown('password')}
                    />
                    {password ? <StrengthMeter password={password} /> : null}
                  </>
                )}
              </Animated.View>
            </Shake>

            {banner ? (
              <Animated.View
                entering={FadeInDown.duration(220)}
                exiting={FadeOut.duration(150)}
                style={[styles.banner, { backgroundColor: colors.dangerSoft }]}
              >
                <Text variant="small" tone="danger">
                  {banner}
                </Text>
              </Animated.View>
            ) : null}

            <Button
              label={t(mode === 'login' ? 'auth.login' : 'login.submit_register')}
              block
              loading={submit.isPending}
              disabled={Boolean(pendingProvider)}
              onPress={onSubmit}
            />
            </>
            )}

            <Pressable onPress={() => switchMode(mode === 'login' ? 'register' : 'login')} style={styles.switchLink}>
              <Text variant="small" tone="muted">
                {`${t(mode === 'login' ? 'auth.no_account' : 'auth.has_account')} `}
                <Text variant="smallStrong" tone="primary">
                  {t(mode === 'login' ? 'auth.create_account' : 'auth.login')}
                </Text>
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 4, gap: 18 },
  hero: { gap: 6 },
  form: { gap: 16 },
  fields: { gap: 14 },
  oauth: { gap: 10 },
  switch: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, height: 46 },
  switchPill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: radius.pill },
  switchItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  banner: { padding: 12, borderRadius: radius.md },
  switchLink: { alignSelf: 'center', paddingVertical: 6 },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -6 },
  segments: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  segmentFill: { height: 4, borderRadius: 2 },
  mfaBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  codeCell: { flex: 1, height: 56, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  codeChar: { fontSize: 24, fontWeight: '700', fontFamily: mono },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  center: { textAlign: 'center' },
  methods: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, borderRadius: radius.md, borderWidth: 1.5 },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, zIndex: 2 },
  country: { height: 52, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1.5, justifyContent: 'center' },
  countryList: { position: 'absolute', top: 56, left: 0, width: 230, maxHeight: 260, borderRadius: radius.md, borderWidth: 1, zIndex: 10, elevation: 6 },
  countryItem: { paddingHorizontal: 12, paddingVertical: 10 },
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
});
