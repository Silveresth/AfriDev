import { Check, FolderPlus, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { haptic } from '@/shared/motion';
import { radius, typography, useTheme } from '@/shared/theme';
import { Sheet, Text, useToast } from '@/shared/ui';

import { type BookmarkTarget, useCollectionActions, useCollections, useToggleInCollection } from './api';

/** « Enregistrer dans… » : cases à cocher des collections, et création d'une nouvelle (comme le web). */
export function SaveSheet({
  target,
  title,
  savedIn,
  visible,
  onClose,
}: {
  target: BookmarkTarget;
  title: string;
  savedIn: string[];
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const { height } = useWindowDimensions();
  const collections = useCollections();
  const toggle = useToggleInCollection();
  const { create } = useCollectionActions();
  const [name, setName] = useState('');
  const checked = new Set(savedIn);

  const flip = (collectionId: string, collectionName: string) => {
    const next = !checked.has(collectionId);
    haptic.select();
    toggle.mutate(
      { collectionId, target, saved: next },
      {
        onSuccess: () => toast(t(next ? 'bm.saved_in' : 'bm.removed_from', { name: collectionName })),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    );
  };

  const createAndSave = async () => {
    const clean = name.trim();
    if (!clean) return;
    try {
      const collection = await create.mutateAsync({ name: clean, is_private: true });
      await toggle.mutateAsync({ collectionId: collection.id, target, saved: true });
      toast(t('bm.saved_in', { name: collection.name }));
      setName('');
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('bm.save_in')}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text variant="small" tone="muted" numberOfLines={2} style={styles.subtitle}>
          {title}
        </Text>
        {collections.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <ScrollView style={{ maxHeight: height * 0.4 }} keyboardShouldPersistTaps="handled">
            {(collections.data ?? []).map((collection) => {
              const on = checked.has(collection.id);
              return (
                <Pressable
                  key={collection.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  disabled={toggle.isPending}
                  onPress={() => flip(collection.id, collection.name)}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressed }]}
                >
                  <View style={[styles.box, on ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.lineStrong }]}>
                    {on ? <Check size={14} color={colors.onPrimary} strokeWidth={3} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {collection.name}
                    </Text>
                    <Text variant="caption" tone="faint">
                      {t('bm.items', { count: collection.item_count })}
                    </Text>
                  </View>
                  {collection.is_private ? <Lock size={14} color={colors.inkFaint} /> : null}
                </Pressable>
              );
            })}
            {!collections.data?.length ? (
              <Text variant="small" tone="muted" style={styles.subtitle}>
                {t('bm.first')}
              </Text>
            ) : null}
          </ScrollView>
        )}
        <View style={[styles.create, { borderTopColor: colors.line }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={60}
            placeholder={t('bm.new_ph')}
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.primary}
            onSubmitEditing={() => void createAndSave()}
            returnKeyType="done"
            style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.container }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('bm.create')}
            disabled={!name.trim() || create.isPending}
            onPress={() => void createAndSave()}
            style={[styles.add, { backgroundColor: name.trim() ? colors.primary : colors.container }]}
          >
            {create.isPending ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <FolderPlus size={18} color={name.trim() ? colors.onPrimary : colors.inkFaint} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subtitle: { paddingHorizontal: 20, paddingBottom: 8 },
  loading: { padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, minHeight: 56 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  create: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  input: { flex: 1, height: 44, borderRadius: radius.md, paddingHorizontal: 14 },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
