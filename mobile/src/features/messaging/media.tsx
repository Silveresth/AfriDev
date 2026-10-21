import {
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Image } from 'expo-image';
import { Mic, Pause, Play } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { absoluteUrl, type Schemas, uploadFromUri } from '@/shared/api';
import { pickAndUploadMedia as pickAndUpload } from '@/shared/media';
import { useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';
import { VideoPlayer } from '@/shared/video';

type MediaAsset = Schemas['MediaOutput'];

/** Photo ou vidéo de la galerie, envoyée vers le stockage objet ; renvoie l'id du média. */
export async function pickAndUploadMedia(): Promise<string | null> {
  return (await pickAndUpload())?.id ?? null;
}

/** Enregistrement d'un message vocal (AAC / m4a), 2 minutes au plus. */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new Error('Autorisez le micro dans les réglages du téléphone.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: 120 });
  }

  async function stop(): Promise<string | null> {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    return recorder.uri;
  }

  async function upload(uri: string) {
    const media = await uploadFromUri(uri, 'audio', 'audio/mp4', 'vocal.m4a');
    return media.id;
  }

  return { recording: state.isRecording, seconds: Math.floor((state.durationMillis ?? 0) / 1000), start, stop, upload };
}

/** Photo, vidéo ou vocal dans une bulle. */
export function ChatMedia({ media, mine }: { media: MediaAsset; mine: boolean }) {
  if (media.kind === 'audio') return <VoiceBubble uri={absoluteUrl(media.urls.opus) ?? absoluteUrl(media.original_url) ?? ''} mine={mine} />;
  if (media.kind === 'video') return <VideoBubble uri={absoluteUrl(media.original_url) ?? ''} />;
  const uri = absoluteUrl(media.urls.large ?? media.original_url);
  const ratio = media.width && media.height ? media.width / media.height : 3 / 4;
  return <Image source={{ uri }} style={[styles.image, { aspectRatio: ratio }]} contentFit="cover" transition={150} />;
}

function VideoBubble({ uri }: { uri: string }) {
  return <VideoPlayer uri={uri} style={styles.video} autoPlay={false} compact />;
}

function VoiceBubble({ uri, mine }: { uri: string; mine: boolean }) {
  const { colors } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const tint = mine ? colors.onPrimary : colors.ink;
  const seconds = Math.round(status.playing ? status.currentTime : status.duration || 0);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (status.playing) player.pause();
        else {
          if (status.didJustFinish || (status.duration && status.currentTime >= status.duration)) player.seekTo(0);
          player.play();
        }
      }}
      style={[styles.voice, { backgroundColor: mine ? colors.primary : colors.container }]}
    >
      {status.playing ? <Pause size={18} color={tint} fill={tint} /> : <Play size={18} color={tint} fill={tint} />}
      <View style={[styles.wave, { backgroundColor: mine ? 'rgba(255,255,255,0.35)' : colors.lineStrong }]}>
        <View
          style={[
            styles.progress,
            { backgroundColor: tint, width: `${status.duration ? Math.min(100, (status.currentTime / status.duration) * 100) : 0}%` },
          ]}
        />
      </View>
      <Mic size={14} color={tint} />
      <Text variant="caption" style={{ color: tint }}>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { width: 220, maxHeight: 320, borderRadius: 18 },
  video: { width: 240, height: 320, borderRadius: 18, backgroundColor: '#000' },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, width: 230 },
  wave: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progress: { height: 4 },
});
