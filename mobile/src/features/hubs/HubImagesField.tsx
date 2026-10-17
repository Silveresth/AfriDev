import { Image } from 'expo-image';
import { Camera, ImagePlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PhotoAccessDenied, pickProfileImage } from '@/features/profile/pickImage';
import { absoluteUrl, errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { PressableScale } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';
import { Text, useToast } from '@/shared/ui';

type Target = 'avatar' | 'banner';

/** Bannière et photo du hub, choisies dans la galerie et envoyées tout de suite. */
export function HubImagesField({
  name,
  bannerUrl,
  imageUrl,
  onChange,
  onBusyChange,
}: {
  name: string;
  bannerUrl: string;
  imageUrl: string;
  onChange: (changes: { banner?: string; image?: string }) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const [previews, setPreviews] = useState<{ avatar?: string; banner?: string }>({});
  const [busy, setBusy] = useState<Record<Target, boolean>>({ avatar: false, banner: false });
  useEffect(() => onBusyChange(busy.avatar || busy.banner), [busy, onBusyChange]);

  const pick = async (target: Target) => {
    try {
      const picked = await pickProfileImage(target);
      if (!picked) return;
      setPreviews((current) => ({ ...current, [target]: picked.preview }));
      setBusy((current) => ({ ...current, [target]: true }));
      const url = await picked.upload;
      onChange(target === 'avatar' ? { image: url } : { banner: url });
    } catch (error) {
      setPreviews((current) => ({ ...current, [target]: undefined }));
      toast(error instanceof PhotoAccessDenied ? t('edit.photo_denied') : errorMessage(error), 'error');
    } finally {
      setBusy((current) => ({ ...current, [target]: false }));
    }
  };

  const banner = previews.banner ?? absoluteUrl(bannerUrl);
  const image = previews.avatar ?? absoluteUrl(imageUrl);

  return (
    <View style={styles.wrap}>
      <PressableScale scaleTo={0.98} accessibilityLabel={t('edit.change_banner')} onPress={() => void pick('banner')}>
        <View style={[styles.banner, { backgroundColor: colors.container }]}>
          {banner ? <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <View style={styles.badge}>
            {busy.banner ? <ActivityIndicator size="small" color="#FFFFFF" /> : <ImagePlus size={16} color="#FFFFFF" />}
          </View>
        </View>
      </PressableScale>
      <PressableScale
        scaleTo={0.95}
        accessibilityLabel={t('hubs.image')}
        onPress={() => void pick('avatar')}
        style={[styles.avatar, { backgroundColor: colors.containerHigh, borderColor: colors.background }]}
      >
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text variant="title" tone="muted">
            {(name.trim()[0] ?? '?').toUpperCase()}
          </Text>
        )}
        <View style={styles.camera}>
          {busy.avatar ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Camera size={14} color="#FFFFFF" />}
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 36 },
  banner: { aspectRatio: 3, borderRadius: radius.lg, overflow: 'hidden', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 8 },
  badge: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  avatar: {
    position: 'absolute',
    left: 14,
    bottom: 0,
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
