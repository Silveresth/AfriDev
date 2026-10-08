# infra/

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | PostgreSQL + pgvector, Redis, Meilisearch, PowerSync (dev local) |
| `postgres/init.sql` | extension `vector`, publication PowerSync, base de stockage PowerSync |
| `powersync/` | configuration du service et règles de synchronisation (ce que chaque appareil reçoit) |
| `nginx/` | reverse proxy de production |

La CI vit dans `.github/workflows/` à la racine (emplacement imposé par GitHub).
