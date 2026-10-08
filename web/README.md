# web/ — Next.js feature-first

Next.js 16 (App Router), Tailwind CSS 4, TanStack Query, PWA (Serwist).
Design system façon shadcn/ui (`components.json`, composants dans `src/shared/ui`) : base neutre
inspirée de Vercel / GitHub, terre cuite AfriDev en accent, Geist + Geist Mono, thèmes clair et sombre.

```
src/
├── app/          routes minces : assemblent features/ et shared/
│   ├── (auth)/   connexion, code SMS, retour OAuth (colonne étroite)
│   └── (main)/   pages avec le cadre (barre latérale, en-tête, onglets mobiles)
├── features/     une feature = api.ts + components/ + index.ts (seul point d'entrée) :
│                 hubs, bookmarks, jobs-events, profile, settings, feed, qa, snippets…
└── shared/       socle sans métier : api, query, session, offline, data-saver, drafts,
                  security-guard, media, realtime, layout, ui, theme…
```

## Données : « l'appli lit d'abord sa copie locale »

- **Lecture** : API REST typée (`@afridev/api-client`, généré depuis l'OpenAPI de Django) +
  cache TanStack Query **persisté dans IndexedDB** : chaque écran s'affiche immédiatement
  depuis sa dernière copie, même hors ligne, puis se met à jour en arrière-plan.
- **Écriture hors ligne** : `shared/offline/outbox.ts` garde posts, commentaires, questions,
  réponses, snippets et projets dans IndexedDB (UUID générés sur l'appareil) et les rejoue via
  `POST /api/sync/upload/` au retour du réseau. Un double envoi est ignoré par le backend ;
  les envois refusés apparaissent dans Réglages.
- **PowerSync** (facultatif) : si `NEXT_PUBLIC_POWERSYNC_URL` est défini, le coffre de snippets
  lit la copie SQLite synchronisée. Le module n'est téléchargé qu'à ce moment-là.
- **Brouillons** : enregistrés toutes les 2 s dans IndexedDB (`shared/drafts`).
- **Security Guard** : mêmes règles que le backend (`packages/validation`), exécutées dans le
  navigateur ; la publication est verrouillée tant qu'un secret est présent.

## Économie de données

- Mode « Texte seul » (automatique en 2G/3G ou avec Save-Data) : polices système, médias remplacés
  par un aperçu ThumbHash à toucher pour charger.
- Vidéos jamais lues automatiquement ; hls.js chargé seulement au clic ; qualité plafonnée.
- Images recompressées en WebP dans le navigateur avant l'envoi.
- Budget : **moins de 300 Ko de JavaScript compressé par page** (mesuré : ~190 Ko pour la
  connexion, ~275 Ko pour le fil).

## Règles

- `app/` ne fait qu'assembler ; une feature n'importe une autre que par son `index.ts` ;
  `shared/` n'importe jamais `features/` (`eslint-plugin-boundaries`).
- Pages publiques (question, snippet, post, projet, profil) rendues côté serveur pour le SEO ;
  pages personnelles protégées par `RequireAuth` côté client.

## Commandes

```bash
pnpm install
pnpm --filter web dev          # http://localhost:3000 (API attendue sur NEXT_PUBLIC_API_URL)
pnpm --filter web lint && pnpm --filter web typecheck
pnpm --filter web build        # inclut le service worker (Serwist)
pnpm generate:api              # après un changement de l'API Django
```

API locale sans Docker : voir `backend/README.md` (mode `DJANGO_LITE=1` et données de démo).
