import { useQueryClient } from '@tanstack/react-query';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { api, unwrap } from '@/shared/api';
import { goToRoute, notificationRoute, notificationWebUrl, openLink } from '@/shared/lib';

/**
 * Notifications push mobiles (Expo → FCM / APNs) :
 * - le jeton Expo de l'appareil est envoyé à l'API à chaque ouverture de session ;
 * - toucher une notification ouvre l'écran concerné ;
 * - à la déconnexion, l'appareil est désinscrit (il ne reçoit plus les alertes de personne).
 */

export type PushState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

const ASKED_KEY = 'afridev.push-asked';
const CHANNEL_ID = 'default';
let deviceToken: string | null = null;
let handledResponse: string | null = null;

// Appli ouverte : la notification s'affiche aussi en bannière (le compteur est rafraîchi).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Expo Go (Android) et les émulateurs ne reçoivent pas de push distants. */
function isSupported() {
  return Platform.OS !== 'web' && Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

export async function pushState(): Promise<PushState> {
  if (!isSupported()) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status as PushState;
}

/**
 * Enregistre l'appareil. `prompt` : affiche la demande d'autorisation du système si elle n'a
 * jamais été refusée définitivement.
 */
export async function registerForPush({ prompt }: { prompt: boolean }): Promise<PushState> {
  if (!isSupported()) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'AfriDev',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#C84B20',
    });
  }
  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && prompt && canAskAgain) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return status as PushState;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  deviceToken = token;
  await unwrap(
    api.POST('/api/notifications/devices/', { body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' } }),
  );
  return 'granted';
}

/** Déconnexion : sans session requise côté API, la requête part même après l'effacement des jetons. */
export function unregisterPush() {
  const token = deviceToken;
  deviceToken = null;
  if (!token) return;
  void api.POST('/api/notifications/devices/unregister/', { body: { token } }).catch(() => undefined);
}

/**
 * Monté une fois connecté : enregistre l'appareil (la demande d'autorisation n'apparaît
 * qu'une fois, ensuite Réglages > Notifications), ouvre l'écran d'une notification touchée et
 * rafraîchit la liste à chaque notification reçue.
 */
export function PushRegistration() {
  const queryClient = useQueryClient();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!isSupported()) return;
    void (async () => {
      const asked = await SecureStore.getItemAsync(ASKED_KEY).catch(() => null);
      await registerForPush({ prompt: !asked });
      if (!asked) await SecureStore.setItemAsync(ASKED_KEY, '1').catch(() => undefined);
    })().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isSupported()) return;
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    // Jeton renouvelé par le système : renvoyé à l'API.
    const rotated = Notifications.addPushTokenListener(() => {
      void registerForPush({ prompt: false }).catch(() => undefined);
    });
    return () => {
      received.remove();
      rotated.remove();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    // Le hook redonne la dernière réponse à chaque montage (reconnexion) : une seule ouverture.
    const id = lastResponse.notification.request.identifier;
    if (id === handledResponse) return;
    handledResponse = id;
    const data = lastResponse.notification.request.content.data as { notification_id?: string } | undefined;
    if (data?.notification_id) {
      void api
        .POST('/api/notifications/{notification_id}/read/', { params: { path: { notification_id: data.notification_id } } })
        .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
        .catch(() => undefined);
    }
    // Démarrage à froid depuis la notification : la navigation n'est prête qu'au tour suivant.
    const timer = setTimeout(() => {
      const route = notificationRoute(data);
      const web = notificationWebUrl(data);
      if (!route && web) void openLink(web);
      else goToRoute(route ?? '/notifications');
    }, 0);
    return () => clearTimeout(timer);
  }, [lastResponse, queryClient]);

  return null;
}
