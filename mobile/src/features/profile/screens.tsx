import { router, useLocalSearchParams } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/shared/i18n';
import { useSession } from '@/shared/session';
import { useTheme } from '@/shared/theme';
import { ErrorState, Header, IconButton, Loading, ThemeToggle } from '@/shared/ui';

import { usePublicProfile } from './api';
import { ProfileView } from './ProfileView';

/** Onglet Profil : ma page (modifiable), réglages à un toucher. */
export function MyProfileScreen() {
  const { colors } = useTheme();
  const { profile } = useSession();
  const { t } = useT();

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={t('nav.profile')}
        large
        right={
          <>
            <ThemeToggle />
            <IconButton icon={Settings} label={t('nav.settings')} onPress={() => router.push('/settings')} />
          </>
        }
      />
      {profile ? <ProfileView profile={profile} me={profile} /> : <Loading />}
    </View>
  );
}

export function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { colors } = useTheme();
  const { profile: me } = useSession();
  const isMe = Boolean(me && me.username.toLowerCase() === username.toLowerCase());
  const profile = usePublicProfile(username);
  const data = isMe ? me : profile.data;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title={`@${username}`} back />
      {data ? (
        <ProfileView profile={data} me={isMe ? me : undefined} onRefresh={() => void profile.refetch()} />
      ) : profile.isPending ? (
        <Loading />
      ) : (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
