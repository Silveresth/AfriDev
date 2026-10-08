# backend/ — Django feature-first

Django 5.2 + DRF, Celery + Redis (tâches de fond), Channels (temps réel),
PostgreSQL + pgvector (RAG), Meilisearch (recherche tolérante aux fautes),
Groq pour l'IA (modèles Llama « smart » / « fast », Whisper pour la voix).

```
config/        configuration du projet, aucune logique métier
core/          socle commun (BaseModel, pagination, erreurs, quotas, jobs IA, auth WebSocket)
integrations/  un client par fournisseur (llm=Groq, embeddings, github, sms, push, search, storage,
               transcription) — n'importe jamais features/
features/      un dossier par fonctionnalité métier
tests/         tests d'intégration bout en bout (WebSocket, ASGI complet)
```

## Intérieur d'une feature

```
features/<nom>/
├── api/            serializers.py, views.py (minces), urls.py
├── models.py
├── services.py     écritures (+ apply_offline_write pour la synchro hors ligne)
├── selectors.py    lectures
├── handlers.py     récepteurs des events des autres features
├── tasks.py        Celery (préfixe ai_ → file « ai »)
├── events.py       signaux publiés vers les autres features
├── prompts/        prompts IA (.md) propres à la feature
├── migrations/
└── tests/
```

## Règles

- Les vues ne contiennent pas de logique : écritures → `services.py`, lectures → `selectors.py`.
- Une feature n'importe **jamais** les modèles d'une autre : elle passe par ses `services` /
  `selectors` ou écoute ses `events` (ex. `knowledge` écoute `snippet_published`).
  Les références entre features sont des UUID (`post_id`, `media_id`), pas des clés étrangères.
- L'IA vit dans la feature qui l'utilise (`profiles/bio_generator.py`, `qa/rag_answer.py`) ;
  seul le client technique est dans `integrations/llm/`. Tous les appels IA passent par Celery,
  avec quotas par utilisateur (`core/throttling.py`) et cache des réponses.
- Chaque table synchronisée par PowerSync accepte des UUID générés hors ligne : rejouer un envoi
  est sans effet. Les erreurs métier sont écartées (`SyncRejection`) sans bloquer la file.
- `lint-imports` fait respecter ces frontières (CI).

## Modules → features

| Module | Features | Points clés |
|---|---|---|
| 1. Identité tech | `accounts`, `profiles` | e-mail/mot de passe, OTP SMS, OAuth GitHub/GitLab, JWT ; bio IA, QR code |
| 2. Fil et studio social | `feed`, `discussions`, `translation` | posts, sondages, vidéos courtes, likes ; commentaires en direct, résumé IA en 3 points ; traduction / vulgarisation |
| 3. Entraide et snippets | `qa`, `snippets`, `knowledge` | réponse RAG, reformulation, questions vocales ; Security Guard 2 étages ; index pgvector + Meilisearch |
| 4. Open source | `projects`, `matchmaking`, `onboarding_agent` | good first issues GitHub ; recommandations et candidatures ; guide de démarrage d'un dépôt |
| 5. Low-data / hors ligne | `sync`, `media` | jetons PowerSync + JWKS, file d'écritures hors ligne ; HLS 240p-720p, WebP/AVIF + ThumbHash, Opus |
| 6. Communauté pro | `hubs`, `bookmarks`, `jobs_events` | hubs h/<slug> (adhésions, règles, fil) ; collections de marque-pages ; Job Board et événements tech |
| Transverse | `notifications`, `moderation` | in-app + WebSocket + push Expo + e-mail (types coupables) ; signalements et modération IA |

Réputation (`profiles/reputation.py`) : karma (+5 par vote ↑ reçu, +15 par réponse acceptée, +10 par
snippet enregistré par un autre membre) et badges automatiques, recalculés à chaque événement ;
`python manage.py recompute_karma` rafraîchit tout le monde (classement « Top 5 % »).
Sécurité du compte (`accounts/security.py`) : sessions révocables (claim `sid` des JWT), double
authentification TOTP, jetons d'accès personnels `afd_…` (`Authorization: Bearer`), export RGPD
(`GET /api/accounts/me/export/`).

Documentation interactive de l'API : `/api/docs/` (schéma : `/api/schema/`).
Temps réel : `ws://<hôte>/ws/discussions/<post_id>/?token=<jwt>` et `ws://<hôte>/ws/notifications/?token=<jwt>`.

## Commandes

```bash
docker compose -f ../infra/docker-compose.yml up -d       # Postgres, Redis, Meilisearch, PowerSync
uv sync --extra dev
uv run python manage.py migrate
uv run python manage.py runserver                          # HTTP + WebSocket (daphne)
uv run celery -A config worker -Q default,ai,sms,github -l info
uv run python manage.py spectacular --file openapi.yaml    # puis `pnpm generate:api` à la racine
uv run ruff check . && uv run lint-imports && uv run pytest
```

**Sans Docker (mode léger)** : SQLite, cache et temps réel en mémoire, tâches immédiates.

```bash
set DJANGO_LITE=1
python manage.py migrate
python manage.py shell -c "import scripts.seed_demo as s; s.run()"   # comptes amina, kofi, fatou
python manage.py runserver                                           # mot de passe : Demo-AfriDev-2026
```

Sans `uv` (Windows) : `python -m venv .venv`, puis installer les dépendances de `pyproject.toml`
avec `.venv\Scripts\pip install ...` et lancer les mêmes commandes avec `.venv\Scripts\python`.

Les tests n'ont besoin d'aucun service : `config.settings.test` utilise SQLite, un cache et une
couche Channels en mémoire, et Celery en mode immédiat. Définir `TEST_DATABASE_URL` pour les
exécuter sur PostgreSQL + pgvector (c'est ce que fait la CI).
