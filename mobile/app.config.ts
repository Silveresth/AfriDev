import { existsSync } from 'node:fs';

import type { ExpoConfig } from 'expo/config';

const projectId = process.env.EAS_PROJECT_ID || '2a8f138b-c664-49ca-8935-4bef7ee3e08c';
// Push Android (FCM) : fichier du projet Firebase, fourni comme secret EAS (GOOGLE_SERVICES_JSON)
// ou posé à la racine de mobile/ (non versionné). Absent : l'appli se construit, sans push Android.
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (existsSync('./google-services.json') ? './google-services.json' : undefined);

const config: ExpoConfig = {
  name: 'AfriDev Exchange',
  slug: 'afridev-exchange',
  scheme: 'afridev', // liens profonds : afridev://u/<username>
  // runtimeVersion suit cette version : à augmenter à chaque ajout de module natif
  // (0.3.0 : expo-image-picker / expo-image-manipulator ; 0.4.0 : expo-notifications / expo-device),
  // sinon EAS Update enverrait ce JS à d'anciens binaires qui n'ont pas ces modules.
  version: '0.4.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './src/assets/icon.png',
  ios: {
    bundleIdentifier: 'com.afridev.exchange',
    supportsTablet: false,
  },
  android: {
    package: 'com.afridev.exchange',
    edgeToEdgeEnabled: true,
    adaptiveIcon: { foregroundImage: './src/assets/adaptive-icon.png', backgroundColor: '#C84B20' },
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  web: { bundler: 'metro' },
  // Splash d'Expo Go (lu dans le manifeste) : mêmes valeurs que le plugin ci-dessous.
  splash: { image: './src/assets/splash-logo.png', resizeMode: 'contain', backgroundColor: '#C84B20' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    // Notifications push : couleur d'accent sur Android (l'icône reprend celle de l'appli).
    ['expo-notifications', { color: '#C84B20', defaultChannel: 'default' }],
    // Photo de profil et bannière : galerie seulement (pas d'appareil photo ni de micro).
    [
      'expo-image-picker',
      {
        photosPermission: "AfriDev a besoin d'accéder à vos photos pour votre photo de profil et votre bannière.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    // Même fond, même logo et même taille (128) que la 1re image de AnimatedSplash : enchaînement invisible.
    [
      'expo-splash-screen',
      {
        image: './src/assets/splash-logo.png',
        imageWidth: 128,
        backgroundColor: '#C84B20',
        dark: { image: './src/assets/splash-logo.png', backgroundColor: '#C84B20' },
      },
    ],
  ],
  // Correctifs à chaud via EAS Update, sans attendre la validation des stores.
  runtimeVersion: { policy: 'appVersion' },
  ...(projectId ? { updates: { url: `https://u.expo.dev/${projectId}` } } : {}),
  extra: {
    eas: { projectId },
  },
};

export default config;
