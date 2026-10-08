# afridev-exchange

Plateforme d'entraide pour développeurs africains : identité tech, fil social, questions-réponses,
coffre-fort de snippets, open source — pensée **hors ligne d'abord** et **faible consommation de données**.

## Principe : l'appli lit d'abord sa copie locale

Le web et le mobile ne lisent pas directement le serveur : ils lisent une **copie SQLite locale**
(PowerSync) synchronisée en arrière-plan avec PostgreSQL. Les écrans s'affichent tout de suite,
et les écritures faites hors ligne partent toutes seules au retour du réseau.

## Organisation (monorepo pnpm + Turborepo)

```
afridev-exchange/
├── backend/        # Django + DRF, Celery, Channels, PostgreSQL + pgvector
├── web/            # Next.js (App Router) + Tailwind, PWA (Serwist)
├── mobile/         # Expo + React Native, Expo Router
├── packages/
│   ├── api-client/   # client + types générés depuis l'OpenAPI de Django
│   ├── sync-schema/  # schéma de la base locale hors ligne (PowerSync)
│   └── validation/   # schémas Zod communs + règles anti-secrets (Security Guard)
├── infra/          # docker-compose infra, PowerSync, nginx, postgres init
├── docker-compose.yml # Orchestration complète multi-conteneurs
└── .github/workflows/ci.yml
```

Les trois couches suivent la même règle **feature-first** : un dossier par fonctionnalité métier
(calqué sur les 5 modules) et un dossier partagé qui n'importe jamais de code métier.

| Module | Django (`features/`) | Web et mobile (`features/`) |
|---|---|---|
| 1. Identité tech | accounts, profiles | auth, profile |
| 2. Fil et studio social | feed, discussions, translation | feed, discussions |
| 3. Entraide et snippets | qa, snippets, knowledge | qa, snippets |
| 4. Open source | projects, matchmaking, onboarding_agent | projects, matchmaking, onboarding-agent |
| 5. Low-data et hors ligne | sync, media | shared/offline, shared/data-saver, shared/drafts, shared/media |

Frontières vérifiées en CI : **import-linter** (backend), **eslint-plugin-boundaries** (web, mobile).

---

## Démarrage rapide avec Docker (Option recommandée)

Pour lancer **toute l'application** (PostgreSQL, Redis, Meilisearch, PowerSync, Backend Django, Worker Celery, Frontend Web Next.js et Reverse Proxy Nginx) en une seule commande :

```bash
# Copier les variables d'environnement si ce n'est pas déjà fait
cp .env.example .env

# Lancer tous les conteneurs
docker compose up --build -d
```

Accès aux services :
- **Web App :** [http://localhost:3000](http://localhost:3000) (ou via Nginx sur [http://localhost:80](http://localhost:80))
- **API Backend / Swagger :** [http://localhost:8000/api/schema/swagger-ui/](http://localhost:8000/api/schema/swagger-ui/)
- **PowerSync :** [http://localhost:8080](http://localhost:8080)
- **Meilisearch :** [http://localhost:7700](http://localhost:7700)

---

## Démarrage en Développement Local

### 1. Lancer l'infrastructure de données
```bash
docker compose -f infra/docker-compose.yml up -d
```

### 2. Backend (Django + Celery)
> **Prérequis :** [uv](https://github.com/astral-sh/uv) installé (`curl -LsSf https://astral.sh/uv/install.sh` ou sous Windows : `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`).

```bash
cd backend
uv sync --extra dev
uv run python manage.py migrate
uv run python manage.py runserver
```

*(Optionnel)* Pour lancer le worker Celery en local :
```bash
cd backend
uv run celery -A config worker -l info
```

### 3. Frontend Web et Mobile (depuis la racine)
```bash
corepack enable
pnpm install
pnpm generate:api      # régénère le client TypeScript depuis l'OpenAPI de Django
pnpm --filter web dev  # lance Next.js sur http://localhost:3000
pnpm --filter mobile start # lance Metro / Expo pour le mobile
```

> **Note Windows :** Si l'exécution des scripts est désactivée dans PowerShell, exécutez dans un terminal administrateur : `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` ou utilisez `pnpm.cmd`.

---

## Tests et Qualité du Code

```bash
# Tests du backend (114 tests pytest avec Postgres/SQLite)
cd backend && uv run pytest

# Typecheck global TypeScript (Web, Mobile et Packages)
pnpm typecheck

# Linter de code global (ESLint + boundaries)
pnpm lint

# Tests End-to-End Playwright (Web)
pnpm test
```
