import { linkDomain } from '@afridev/validation';
import { Image } from 'expo-image';
import { Clock, ExternalLink, Globe, Play, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type Schemas } from '@/shared/api';
import { useDataSaver } from '@/shared/data-saver';
import { useT } from '@/shared/i18n';
import { openExternal } from '@/shared/lib';
import { PressableScale } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

type LinkPreview = NonNullable<Schemas['PostOutput']['link_preview']>;

/**
 * Bannière de la ressource d'un post, comme une image : vignette, site, titre, description.
 * Toucher la bannière ouvre la ressource dans le navigateur du système ; le reste de la carte
 * ouvre le post. Carte pas encore prête ou sans image : bannière compacte (domaine, adresse).
 * `detail` : résumé IA et temps de lecture sous la bannière.
 */
export function ResourceLink({ url, preview, detail = false }: { url: string; preview?: LinkPreview | null; detail?: boolean }) {
  const { colors } = useTheme();
  const { t } = useT();
  const { textOnly } = useDataSaver();
  const [broken, setBroken] = useState(false);
  const ready = preview?.status === 'ready';
  const domain = preview?.domain || linkDomain(url);
  const image = ready && preview.image_url && !broken && !textOnly ? preview.image_url : '';
  const summary = detail && ready ? preview.summary : [];
  const site = ready && preview.site_name && preview.site_name !== domain ? `${preview.site_name} · ${domain}` : domain;

  return (
    <View style={styles.wrap}>
      <PressableScale
        scaleTo={0.98}
        accessibilityRole="link"
        accessibilityLabel={`${t('post.open_resource')} : ${domain}`}
        onPress={() => void openExternal(url, colors.background)}
        style={[styles.card, { borderColor: colors.line, backgroundColor: colors.background }]}
      >
        {image ? (
          <View style={[styles.image, { backgroundColor: colors.container }]}>
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} onError={() => setBroken(true)} />
            {preview?.kind === 'video' ? (
              <View style={styles.playWrap} pointerEvents="none">
                <View style={styles.play}>
                  <Play size={26} color="#FFFFFF" fill="#FFFFFF" />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.row}>
          {!image ? (
            <View style={[styles.icon, { backgroundColor: colors.container }]}>
              <Globe size={16} color={colors.primaryInk} />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Text variant="caption" tone="faint" numberOfLines={1} style={styles.site}>
              {site}
            </Text>
            <Text variant="smallStrong" numberOfLines={2}>
              {(ready && preview.title) || url.replace(/^https?:\/\/(www\.)?/i, '')}
            </Text>
            {ready && preview.description ? (
              <Text variant="caption" tone="muted" numberOfLines={2}>
                {preview.description}
              </Text>
            ) : null}
          </View>
          <ExternalLink size={16} color={colors.primaryInk} />
        </View>
      </PressableScale>

      {summary.length || (detail && ready && preview.reading_minutes) ? (
        <View style={[styles.summary, { backgroundColor: colors.secondarySoft }]}>
          <View style={styles.summaryHead}>
            {summary.length ? (
              <View style={styles.inline}>
                <Sparkles size={14} color={colors.secondaryInk} />
                <Text variant="smallStrong" style={{ color: colors.secondaryInk }}>
                  {t('post.summary')}
                </Text>
              </View>
            ) : null}
            {preview?.reading_minutes ? (
              <View style={styles.inline}>
                <Clock size={13} color={colors.secondaryInk} />
                <Text variant="caption" style={{ color: colors.secondaryInk }}>
                  {t('post.reading', { n: preview.reading_minutes })}
                </Text>
              </View>
            ) : null}
          </View>
          {summary.map((point, index) => (
            <Text key={index} variant="small">
              {`• ${point}`}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1.91 },
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  play: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingLeft: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  icon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  site: { textTransform: 'uppercase', letterSpacing: 0.4 },
  summary: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  summaryHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
