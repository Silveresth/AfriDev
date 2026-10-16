# Configuration de la production (VPS)

Ce guide liste tout ce qu'il faut renseigner pour qu'AfriDev Exchange fonctionne en production, et où trouver chaque clé.

---

## 1. Où se trouve le `.env` de production ?

**Sur le VPS, dans `/var/www/AfriDev/.env`.** C'est le seul fichier lu en production.

- Le `.env` n'est **jamais** envoyé sur GitHub : il est dans `.gitignore`. Pousser ton `.env` local ne change donc rien en prod, et c'est voulu, puisque ce fichier contient des secrets.
- Le déploiement automatique (`git push` sur `main`) lance `git pull` sur le VPS. Il ne touche pas au `.env`, car `git clean -fd` conserve les fichiers ignorés.
- **Ton `.env` local** (sur ton PC) sert uniquement au développement. Les deux fichiers ont les mêmes noms de variables, mais pas les mêmes valeurs.

Pour modifier le `.env` de prod :

```bash
ssh root@<IP_DU_VPS>
cd /var/www/AfriDev
nano .env                      # modifier, puis Ctrl+O, Entrée, Ctrl+X
docker compose up -d --no-build backend celery celery-ai   # relance avec les nouvelles valeurs
```

> Le modèle de référence, avec toutes les variables, est [.env.example](.env.example).

---

## 2. Les migrations (`manage.py migrate`)

**Tu n'as rien à lancer à la main.** Le conteneur `backend` exécute `python manage.py migrate --noinput` à chaque démarrage (voir `docker-compose.yml`). Après un `git push`, le déploiement relance le backend avec la nouvelle image, qui applique les migrations.

Les fichiers de migration sont déjà créés et font partie du code poussé. Sur ton PC, `migrate` ne sert que si tu veux mettre à jour **ta base locale** de développement.

### Commandes à lancer une seule fois sur le VPS (après le premier déploiement)

```bash
cd /var/www/AfriDev
# Recalcule le Craft Score de tous les membres (remplace l'ancien Karma).
docker compose exec backend python manage.py recompute_craft
# Génère la clé des notifications push du site, à copier dans le .env (voir § 3.8).
docker compose exec backend python manage.py generate_vapid_key
# Seulement après avoir ajouté VOYAGE_API_KEY (ou changé VOYAGE_MODEL).
docker compose exec backend python manage.py reindex_knowledge
```

Tâche quotidienne (cron) qui supprime les envois de médias jamais confirmés :

```bash
crontab -e
# puis ajouter cette ligne :
30 3 * * * cd /var/www/AfriDev && docker compose exec -T backend python manage.py purge_stale_uploads >> /var/log/afridev-purge.log 2>&1
```

---

## 3. Les variables, une par une

Légende : **Obligatoire** = sans elle, la fonction ne marche pas · *Facultative* = une valeur par défaut convient.

### 3.1 Django (socle)

| Variable | Valeur en prod | Comment l'obtenir |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.prod` | À ajouter pour passer en mode production (voir § 4). Sans elle, le serveur tourne avec les réglages de développement (`DEBUG=True`, e-mails affichés dans les journaux au lieu d'être envoyés). |
| `DJANGO_SECRET_KEY` | longue chaîne aléatoire | **Obligatoire en prod.** `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`. La changer déconnecte tout le monde une fois. |
| `DJANGO_ALLOWED_HOSTS` | `afridev.duckdns.org,backend,localhost,127.0.0.1` | **Obligatoire en prod.** Garde `backend` et `localhost` : le site appelle l'API en interne et le contrôle de santé passe par `localhost`. |
| `PUBLIC_WEB_URL` | `https://afridev.duckdns.org` | Adresse du site (liens dans les e-mails, QR codes). |
| `API_PUBLIC_URL` | `https://afridev.duckdns.org` | Adresse publique de l'API (retour OAuth). |
| `LOG_LEVEL` | `INFO` | *Facultative.* |

`DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `MEILISEARCH_URL`, `CORS_ALLOWED_ORIGINS` et `CSRF_TRUSTED_ORIGINS` sont **déjà fixées par `docker-compose.yml`**. Ne les mets pas dans le `.env`.

### 3.2 Base de données et recherche

| Variable | Valeur | Comment l'obtenir |
|---|---|---|
| `POSTGRES_PASSWORD` | *laisser `postgres`* | ⚠️ Le mot de passe est aussi écrit en dur dans `infra/powersync/powersync.yaml`. Si tu le changes, modifie aussi ce fichier **et** le mot de passe dans la base (`ALTER USER`), sinon PowerSync et le backend ne s'y connectent plus. |
| `MEILI_MASTER_KEY` | chaîne aléatoire ≥ 16 caractères | `openssl rand -base64 32` |
| `MEILISEARCH_KEY` | **la même valeur** que `MEILI_MASTER_KEY` | — |

### 3.3 Intelligence artificielle

| Variable | Valeur | Comment l'obtenir |
|---|---|---|
| `GROQ_API_KEY` | `gsk_…` | **Obligatoire pour toute l'IA** (réponse IA, tags, bio, traduction, résumé, dictée vocale, modération). [console.groq.com/keys](https://console.groq.com/keys) › *Create API Key*. |
| `GROQ_SMART_MODEL` | `openai/gpt-oss-120b` | *Facultative.* Ne remets **pas** `llama-3.3-70b-versatile` : Groq l'a retiré le 16/08/2026. |
| `GROQ_FAST_MODEL` | `openai/gpt-oss-20b` | *Facultative.* Ne remets pas `llama-3.1-8b-instant` (retiré). |
| `GROQ_TRANSCRIPTION_MODEL` | `whisper-large-v3-turbo` | *Facultative.* |
| `AI_QUOTA_PER_DAY` | `50/day` | *Facultative.* Appels IA par membre et par jour. |
| `VOYAGE_API_KEY` | `pa-…` | Recommandée (recherche par le sens, réponse IA plus pertinente). [dashboard.voyageai.com](https://dashboard.voyageai.com) › *API Keys*. Après l'avoir ajoutée : `reindex_knowledge` (§ 2). |
| `MODERATION_SCREEN_NEW_CONTENT` | `true` | *Facultative.* Analyse IA de chaque nouveau contenu. |

Les autres réglages IA (`GROQ_REASONING_*`, `LLM_CACHE_SECONDS`, `AI_TASK_SOFT_TIME_LIMIT`, `EMBEDDING_QUERY_CACHE_SECONDS`, `SEMANTIC_SEARCH_QUOTA`, `MODERATION_*`) ont de bonnes valeurs par défaut.

### 3.4 Photos, vidéos et messages vocaux (Cloudinary)

Les fichiers partent directement du téléphone ou du navigateur vers Cloudinary, qui produit les tailles, les formats (WebP/AVIF), la vidéo en streaming (HLS) et les affiches. Rien de lourd ne tourne sur le VPS. Sans ces variables, les fichiers vont sur le disque du VPS (déconseillé avec 2 Go).

| Variable | Comment l'obtenir |
|---|---|
| `CLOUDINARY_URL` | [console.cloudinary.com](https://console.cloudinary.com) › **Dashboard** › *API environment variable* (bouton copier). Format : `cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>`. |
| *ou* `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Les trois valeurs séparées, sur le même Dashboard (le secret s'affiche avec l'icône œil). |
| `CLOUDINARY_FOLDER` | *Facultative.* Dossier des fichiers dans le compte (`afridev` par défaut). |

Aucun réglage CORS n'est nécessaire : Cloudinary accepte les envois directs depuis un navigateur.

### 3.5 Connexion Google et GitHub

Une seule adresse de retour à déclarer chez chaque fournisseur. Les boutons n'apparaissent que si l'ID **et** le secret sont renseignés.

| Variable | Comment l'obtenir |
|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | [github.com/settings/developers](https://github.com/settings/developers) › *OAuth Apps* › *New OAuth App*. Homepage : `https://afridev.duckdns.org`. **Authorization callback URL** : `https://afridev.duckdns.org/api/accounts/oauth/github/callback/`. Puis *Generate a new client secret*. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | [console.cloud.google.com](https://console.cloud.google.com) › *API et services* › **Écran de consentement OAuth** (scopes `openid`, `email`, `profile`, puis *Publier l'application*), puis *Identifiants* › *Créer* › *ID client OAuth* › type **Application Web**. **URI de redirection autorisé** : `https://afridev.duckdns.org/api/accounts/oauth/google/callback/`. |
| `GITHUB_TOKEN` | *Facultative.* Augmente la limite d'appels à l'API GitHub (synchro des dépôts). [github.com/settings/tokens](https://github.com/settings/tokens) › *Fine-grained token* › accès en lecture seule aux dépôts publics. |

### 3.6 E-mails (mot de passe oublié, alertes importantes)

| Variable | Valeur |
|---|---|
| `EMAIL_URL` | `smtp+tls://<LOGIN>:<CLÉ_SMTP>@smtp-relay.brevo.com:587` |
| `DEFAULT_FROM_EMAIL` | `AfriDev Exchange <no-reply@ton-domaine>` |

Avec **Brevo** (gratuit, 300 e-mails/jour) : [app.brevo.com](https://app.brevo.com) › *Paramètres* › **SMTP & API** › onglet SMTP : le *Login* et une *clé SMTP*.

- Si le login contient `@`, remplace-le par `%40` dans l'URL (ex. `abc%40smtp-brevo.com`).
- Vérifie l'adresse d'expédition dans Brevo (*Expéditeurs*).
- ⚠️ Les e-mails ne partent qu'avec `DJANGO_SETTINGS_MODULE=config.settings.prod` : les réglages de développement les affichent seulement dans les journaux.

### 3.7 SMS (connexion par numéro de téléphone)

| Variable | Comment l'obtenir |
|---|---|
| `SMS_PROVIDER_USERNAME` | [account.africastalking.com](https://account.africastalking.com) › crée une application : son nom d'utilisateur (≠ `sandbox` en prod). |
| `SMS_PROVIDER_API_KEY` | Dans l'application › *Settings* › **API Key**. |
| `SMS_SENDER_ID` | *Facultative.* Nom d'expéditeur, à demander et faire valider chez Africa's Talking. |

### 3.8 Notifications push

**Site web (Web Push)**

| Variable | Comment l'obtenir |
|---|---|
| `WEBPUSH_VAPID_PRIVATE_KEY` | Sur le VPS : `docker compose exec backend python manage.py generate_vapid_key` et copier la ligne affichée. **Ne plus jamais la changer** : sinon tous les navigateurs sont désabonnés. |
| `WEBPUSH_VAPID_SUBJECT` | `mailto:ton-adresse@exemple.com` (contact exigé par les services de push). |

Sur iPhone et iPad, il faut d'abord ajouter le site à l'écran d'accueil (iOS 16.4 minimum).

**Appli mobile (Expo)** : la configuration se fait sur expo.dev, pas dans le `.env`.

1. **Android** : crée un projet sur [console.firebase.google.com](https://console.firebase.google.com) › *Ajouter une appli Android* (package `com.afridev.exchange`) › télécharge **`google-services.json`**.
   - Dans `mobile/`, lance `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret`.
   - Firebase › *Paramètres du projet* › *Comptes de service* › *Générer une clé privée* (fichier JSON) › à téléverser dans [expo.dev](https://expo.dev) › projet › *Credentials* › Android › **FCM V1 service account key**.
2. **iOS** : `eas credentials` › iOS › *Push Notifications* : EAS crée la clé APNs (compte Apple Developer requis).
3. Construis une **nouvelle version** de l'appli (`eas build`) : les notifications sont un module natif, elles ne marchent ni dans Expo Go ni sur émulateur.

| Variable (`.env` du VPS) | Comment l'obtenir |
|---|---|
| `EXPO_ACCESS_TOKEN` | *Facultative.* Seulement si tu actives *Enhanced Security for Push* : expo.dev › *Account settings* › **Access tokens**. |

### 3.9 Synchronisation hors ligne (PowerSync)

| Variable | Comment l'obtenir |
|---|---|
| `POWERSYNC_JWT_PRIVATE_KEY` | **Obligatoire en prod.** Clé RSA sur une seule ligne : `openssl genrsa 2048 \| awk '{printf "%s\\n", $0}'`, à coller entre guillemets doubles dans le `.env`. |

---

## 4. Passer le serveur en mode production

Aujourd'hui, le VPS tourne avec `config.settings.dev`, qui donne `DEBUG=True`, n'envoie pas d'e-mails et expose les traces d'erreur. Pour basculer :

1. Dans `/var/www/AfriDev/.env`, ajoute **au minimum** :
   ```env
   DJANGO_SETTINGS_MODULE=config.settings.prod
   DJANGO_SECRET_KEY=<§ 3.1>
   DJANGO_ALLOWED_HOSTS=afridev.duckdns.org,backend,localhost,127.0.0.1
   POWERSYNC_JWT_PRIVATE_KEY="<§ 3.9>"
   ```
2. Relance : `docker compose up -d --no-build backend celery celery-ai`.
3. Vérifie : `docker compose logs --tail=50 backend` (aucune erreur), puis ouvre `https://afridev.duckdns.org/api/health/`.

Si quelque chose casse, retire la ligne `DJANGO_SETTINGS_MODULE` et relance : le serveur revient aux réglages actuels.

---

## 5. Secrets GitHub (déploiement automatique)

Dans le dépôt GitHub › *Settings* › *Secrets and variables* › *Actions* :

| Secret | Valeur |
|---|---|
| `VPS_HOST` | Adresse IP du VPS. |
| `VPS_SSH_KEY` | Clé **privée** SSH autorisée sur le VPS (`~/.ssh/authorized_keys` de `root`). |

Chaque `git push` sur `main` construit les images web et backend, les publie sur GHCR, puis met à jour le VPS. Les migrations s'appliquent à ce moment-là.

---

## 6. Récapitulatif minimal pour démarrer

```env
# Socle
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_SECRET_KEY=
DJANGO_ALLOWED_HOSTS=afridev.duckdns.org,backend,localhost,127.0.0.1
PUBLIC_WEB_URL=https://afridev.duckdns.org
API_PUBLIC_URL=https://afridev.duckdns.org
POWERSYNC_JWT_PRIVATE_KEY=""
MEILI_MASTER_KEY=
MEILISEARCH_KEY=

# IA
GROQ_API_KEY=
VOYAGE_API_KEY=

# Médias (Cloudinary)
CLOUDINARY_URL=

# Connexion
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# E-mails et SMS
EMAIL_URL=
DEFAULT_FROM_EMAIL=AfriDev Exchange <no-reply@afridev.dev>
SMS_PROVIDER_USERNAME=
SMS_PROVIDER_API_KEY=

# Push
WEBPUSH_VAPID_PRIVATE_KEY=
WEBPUSH_VAPID_SUBJECT=mailto:contact@afridev.dev
```

---

## 7. Points d'attention

- **Clé Next.js en clair** : `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` est écrite dans `deploy.yml` et `docker-compose.yml`, donc visible sur GitHub. Il vaut mieux la remplacer par un secret GitHub (`openssl rand -base64 32`).
- **PowerSync** lit la clé publique de Django via `host.docker.internal`, une adresse qui n'existe pas par défaut sous Linux. Si la synchro hors ligne ne fonctionne pas sur le VPS, c'est la première chose à vérifier.
- **Mémoire (2 Go)** : le worker IA séparé (`celery-ai`) ajoute environ 150 Mo. Surveille-le avec `docker stats`.
