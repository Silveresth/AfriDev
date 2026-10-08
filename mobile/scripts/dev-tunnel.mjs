/**
 * Expo Go en mode tunnel, API comprise.
 *
 * `expo start --tunnel` ne rend joignable que le bundle JS (port 8081) : l'API Django (port 8000)
 * reste invisible pour le téléphone. Ce script ouvre d'abord un tunnel Cloudflare gratuit vers
 * l'API, attend qu'il réponde, puis lance Expo avec EXPO_PUBLIC_API_URL pointant dessus.
 *
 *   pnpm mobile:tunnel            (racine du dépôt)
 *   API_PORT=8001 pnpm mobile:tunnel
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const API_PORT = process.env.API_PORT ?? '8000';

function findCloudflared() {
  const candidates = [
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    '/opt/homebrew/bin/cloudflared',
    '/usr/local/bin/cloudflared',
    '/usr/bin/cloudflared',
  ];
  return candidates.find((path) => existsSync(path)) ?? 'cloudflared';
}

async function apiAnswers(url) {
  try {
    const response = await fetch(`${url}/api/health/`, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

function startExpo(apiUrl, cleanup = () => undefined) {
  const require = createRequire(import.meta.url);
  const expoCli = require.resolve('expo/bin/cli');
  const expo = spawn(process.execPath, [expoCli, 'start', '--tunnel', '--clear'], {
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
  });
  const stop = () => {
    cleanup();
    expo.kill();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  expo.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

async function main() {
  // Adresse stable déjà fournie (domaine ngrok fixe, tunnel Cloudflare nommé) : pas de tunnel éphémère.
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log(`› API : ${process.env.EXPO_PUBLIC_API_URL}\n`);
    startExpo(process.env.EXPO_PUBLIC_API_URL);
    return;
  }
  if (!(await apiAnswers(`http://localhost:${API_PORT}`))) {
    console.error(`\n✖ L'API ne répond pas sur http://localhost:${API_PORT}.`);
    console.error('  Lancez-la d\'abord (dans backend/) : set DJANGO_LITE=1 puis python manage.py runserver 0.0.0.0:8000\n');
    process.exit(1);
  }

  console.log('› Ouverture du tunnel de l\'API (Cloudflare)…');
  const tunnel = spawn(findCloudflared(), ['tunnel', '--url', `http://localhost:${API_PORT}`, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  tunnel.on('error', () => {
    console.error('\n✖ cloudflared introuvable. Installez-le : winget install Cloudflare.cloudflared\n');
    process.exit(1);
  });

  const apiUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Le tunnel ne s\'est pas ouvert en 40 s.')), 40_000);
    const onData = (chunk) => {
      const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    tunnel.stdout.on('data', onData);
    tunnel.stderr.on('data', onData);
  });

  // Le nom DNS du tunnel met quelques secondes à se propager. Le DNS du PC garde parfois en cache
  // un échec trop précoce alors que le téléphone, lui, résout bien : on n'attend pas indéfiniment.
  await new Promise((resolve) => setTimeout(resolve, 6000));
  let reachable = false;
  for (let attempt = 0; attempt < 8 && !reachable; attempt += 1) {
    reachable = await apiAnswers(apiUrl);
    if (!reachable) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  console.log(
    reachable
      ? `✔ API joignable depuis le téléphone : ${apiUrl}\n`
      : `› Tunnel de l'API : ${apiUrl} (le DNS de ce PC ne le voit pas encore, le téléphone oui en général)\n`,
  );

  console.log(`  Retour OAuth à déclarer chez GitHub : ${apiUrl}/api/accounts/oauth/github/callback/`);
  console.log(`  Retour OAuth à déclarer chez Google : ${apiUrl}/api/accounts/oauth/google/callback/\n`);
  startExpo(apiUrl, () => tunnel.kill());
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}\n`);
  process.exit(1);
});
