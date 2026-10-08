# AfriDev Exchange — application mobile

Expo SDK 54 · Expo Router · React Native 0.81 · TanStack Query. Même API et même client typé
(`@afridev/api-client`) que le site web.

## Lancer

```bash
# 1. Backend (dans backend/) : set DJANGO_LITE=1 puis python manage.py runserver 0.0.0.0:8000
# 2. Appli, au choix (à la racine) :
pnpm mobile           # téléphone et PC sur le même Wi-Fi
pnpm mobile:tunnel    # réseau qui isole les appareils : tunnel Expo + tunnel Cloudflare pour l'API
```

Puis scanner le QR code avec Expo Go. `pnpm mobile:tunnel` demande `cloudflared`
(`winget install Cloudflare.cloudflared`) ; ne lancez pas `expo start --tunnel` seul, l'API
resterait injoignable depuis le téléphone (chargement sans fin).

L'adresse de l'API est déduite toute seule en réseau local (IP de la machine qui sert Metro,
`10.0.2.2` sur l'émulateur Android). Pour la forcer : `EXPO_PUBLIC_API_URL=https://api.exemple.com`.
Une requête qui ne répond pas en 15 s affiche une erreur expliquant quoi faire.

## Connexion GitHub / Google

Les boutons passent par le navigateur sécurisé du système. Le fournisseur renvoie vers l'API
(`/api/accounts/oauth/<github|google>/callback/`), qui rebondit vers l'appli avec le code ; les
secrets restent sur le serveur. À faire une fois :

1. Créer l'application OAuth (GitHub : Settings → Developer settings → OAuth Apps ; Google :
   console Cloud → ID client OAuth « Application Web »).
2. Déclarer l'URL de retour `<adresse de l'API>/api/accounts/oauth/github/callback/`
   (et `…/google/callback/`). `pnpm mobile:tunnel` affiche les URL exactes au démarrage.
3. Renseigner `GITHUB_CLIENT_ID/SECRET` et `GOOGLE_CLIENT_ID/SECRET` dans `.env`, relancer l'API.

Google exige une adresse HTTPS stable : utilisez un domaine fixe (ngrok, tunnel Cloudflare nommé,
API en ligne) et passez-le avec `EXPO_PUBLIC_API_URL=https://… pnpm mobile:tunnel`.

## Animations

Reanimated 4 (inclus dans Expo Go) : splash animé enchaîné sur le splash natif, transition de
thème « encre » depuis le doigt, onglets et piles animés, squelettes de chargement, apparition
en cascade des listes, vote, sondages, feuilles, champs et erreurs (secousse + vibration).

Après un changement de dépendances natives : `npx expo prebuild --clean` régénère `android/`.

## Écrans

| Onglet | Contenu |
| --- | --- |
| Accueil | Fil de la communauté (Populaires / Nouveaux / Top), vote ↑↓, sondages, commentaires |
| Actu tech | Hacker News, DEV et médias tech (TechCrunch, The Verge, Ars Technica, Numerama, Frandroid) |
| Q&A | Questions, réponse de l'IA, réponses de la communauté, solution acceptée |
| Hubs | Communautés, adhésion, fil et questions de chaque hub |
| Profil | Identité tech, posts et questions, réglages (thème clair / sombre) |

Le bouton rond « + » publie un post ou une question.

## Actu tech

Les sources externes sont lues **par le backend** (`GET /api/feed/news/?source=&lang=&q=`), mises
en cache 10 minutes et renvoyées dans un format unique : titre, court extrait, lien vers l'article
d'origine. L'appli n'appelle jamais ces sites directement ; un article s'ouvre dans le navigateur
intégré, chez son éditeur.

## Organisation

```
src/app/        routes Expo Router (fichiers minces qui exportent un écran)
src/features/   un dossier par fonctionnalité : api.ts (requêtes) + écrans et composants
src/shared/     api, session, thème, kit UI, utilitaires
```

Design : couleurs à plat uniquement (aucun dégradé), jetons identiques à
`web/src/styles/globals.css`, filets fins plutôt qu'ombres, police système.
