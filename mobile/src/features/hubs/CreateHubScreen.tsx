import { DEFAULT_HUB_ICON, HUB_ICONS, type HubIconKey, hubIconValue } from '@afridev/validation';
import { router } from 'expo-router';
import { Check, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { haptic } from '@/shared/motion';
import { radius, typography, useTheme } from '@/shared/theme';
import { Button, Header, HUB_ICON_COMPONENTS, HubIcon, Text, TextField, useToast } from '@/shared/ui';

import { useCreateHub } from './api';

const MAX_RULES = 10;

/** Adresse h/<slug> proposée à partir du nom (« Python Sénégal » → « python-senegal »). */
function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Création d'un hub (comme sur le site) : aperçu, icône du catalogue, description et règles. */
export function CreateHubScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const create = useCreateHub();
  const [name, setName] = useState('');
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const [icon, setIcon] = useState<HubIconKey>(DEFAULT_HUB_ICON);
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [rule, setRule] = useState('');
  const slug = customSlug ?? slugify(name);
  const canSubmit = name.trim().length >= 2 && slug.length >= 3 && !create.isPending;
  const meta = HUB_ICONS.find((item) => item.key === icon);

  const addRule = () => {
    const value = rule.trim();
    if (!value || rules.length >= MAX_RULES) return;
    setRules([...rules, value]);
    setRule('');
  };

  const submit = () =>
    create.mutate(
      {
        name: name.trim(),
        slug,
        icon: hubIconValue(icon),
        description: description.trim(),
        target_country: country.trim(),
        rules: rule.trim() ? [...rules, rule.trim()] : rules,
      },
      {
        onSuccess: (hub) => {
          haptic.success();
          toast(t('hubs.created', { slug: hub.slug }));
          router.replace(`/h/${hub.slug}`);
        },
      },
    );

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={t('hubs.create')}
        close
        right={<Button label={t('publish.create')} size="sm" disabled={!canSubmit} loading={create.isPending} onPress={submit} style={styles.action} />}
      />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {/* Aperçu : ce que verront les membres. */}
        <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <HubIcon icon={hubIconValue(icon)} name={name || 'Hub'} size={52} />
          <View style={styles.flex}>
            <Text variant="headline" numberOfLines={1}>
              {name.trim() || t('hubs.name')}
            </Text>
            <Text variant="small" tone="muted" numberOfLines={1}>
              h/{slug || '…'}
              {country.trim() ? ` · ${country.trim()}` : ''}
            </Text>
          </View>
        </View>

        <TextField label={t('hubs.name')} value={name} onChangeText={setName} placeholder="Python Sénégal" maxLength={60} />
        <TextField
          label={t('hubs.address')}
          value={slug}
          onChangeText={(value) => setCustomSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={40}
          hint={t('hubs.address_hint')}
        />

        <View style={styles.group}>
          <Text variant="smallStrong">{t('hubs.icon')}</Text>
          <View style={styles.icons} accessibilityRole="radiogroup">
            {HUB_ICONS.map((item) => {
              const Glyph = HUB_ICON_COMPONENTS[item.lucide];
              const active = item.key === icon;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="radio"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    haptic.select();
                    setIcon(item.key);
                  }}
                  style={[
                    styles.icon,
                    active ? { backgroundColor: item.color, borderColor: item.color } : { borderColor: colors.line, backgroundColor: colors.background },
                  ]}
                >
                  <Glyph size={22} color={active ? '#FFFFFF' : item.color} />
                  {active ? (
                    <View style={[styles.check, { backgroundColor: colors.background }]}>
                      <Check size={10} color={item.color} strokeWidth={3} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {meta ? (
            <Text variant="caption" tone="faint">
              {meta.label}
            </Text>
          ) : null}
        </View>

        <TextField
          label={t('hubs.description')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('hubs.description_ph')}
          multiline
          maxLength={500}
          hint={`${description.length} / 500`}
          style={styles.description}
        />
        <TextField label={t('hubs.country')} value={country} onChangeText={setCountry} placeholder="Sénégal" hint={t('hubs.country_hint')} />

        <View style={styles.group}>
          <Text variant="smallStrong">{t('hubs.rules_count', { count: rules.length })}</Text>
          {rules.map((item, index) => (
            <View key={`${item}-${index}`} style={[styles.rule, { borderColor: colors.line }]}>
              <Text variant="caption" tone="faint" style={styles.ruleIndex}>
                {index + 1}.
              </Text>
              <Text variant="small" style={styles.flex}>
                {item}
              </Text>
              <Pressable hitSlop={8} accessibilityLabel={t('common.delete')} onPress={() => setRules(rules.filter((_, i) => i !== index))}>
                <X size={16} color={colors.inkFaint} />
              </Pressable>
            </View>
          ))}
          {rules.length < MAX_RULES ? (
            <View style={styles.ruleInput}>
              <TextInput
                value={rule}
                onChangeText={setRule}
                onSubmitEditing={addRule}
                placeholder={t('hubs.rule_ph')}
                placeholderTextColor={colors.inkFaint}
                selectionColor={colors.primary}
                returnKeyType="done"
                maxLength={200}
                style={[typography.body, styles.input, { color: colors.ink, borderColor: colors.lineStrong, backgroundColor: colors.surface }]}
              />
              <Button label={t('hubs.rule_add')} icon={Plus} variant="secondary" size="sm" disabled={!rule.trim()} onPress={addRule} />
            </View>
          ) : null}
        </View>

        {create.isError ? (
          <Text variant="small" tone="danger">
            {errorMessage(create.error)}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  action: { marginRight: 8 },
  form: { padding: 16, gap: 18, paddingBottom: 48 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  group: { gap: 8 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  icon: { width: 52, height: 52, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  description: { minHeight: 90 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1 },
  ruleIndex: { fontWeight: '700' },
  ruleInput: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 12 },
});
