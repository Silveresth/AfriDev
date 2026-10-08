import type { ExpoConfig } from 'expo/config';

const projectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'AfriDev Exchange',
  slug: 'afridev-exchange',
  scheme: 'afridev', // liens profonds : afridev://u/<username>
  version: '0.2.0',
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
  },
  web: { bundler: 'metro' },
  // Splash d'Expo Go (lu dans le manifeste) : mêmes valeurs que le plugin ci-dessous.
  splash: { image: './src/assets/splash-logo.png', resizeMode: 'contain', backgroundColor: '#C84B20' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
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
