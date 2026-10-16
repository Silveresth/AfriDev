#!/usr/bin/env bash
# Complète le .env de production avec les clés techniques générables sur place, sans jamais
# écraser une valeur déjà présente : clé Django, clé PowerSync, clé Meilisearch, clé VAPID.
# Les secrets restent sur le VPS (rien n'est affiché).
#
#   cd /var/www/AfriDev && bash scripts/setup-prod-secrets.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.env
touch "$ENV_FILE"
cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"

has() { grep -qE "^$1=.+" "$ENV_FILE"; }
put() {
  if has "$1"; then
    echo "  = $1 déjà défini (inchangé)"
  else
    sed -i "/^$1=/d" "$ENV_FILE"
    printf '%s=%s\n' "$1" "$2" >>"$ENV_FILE"
    echo "  + $1 généré"
  fi
}

echo "Clés techniques :"
put DJANGO_SECRET_KEY "$(openssl rand -base64 96 | tr -dc 'A-Za-z0-9' | head -c 80)"
put DJANGO_ALLOWED_HOSTS "afridev.duckdns.org,backend,localhost,127.0.0.1"

if ! has POWERSYNC_JWT_PRIVATE_KEY; then
  # Clé RSA sur une ligne (« \n » échappés), lue telle quelle par Django.
  put POWERSYNC_JWT_PRIVATE_KEY "\"$(openssl genrsa 2048 2>/dev/null | awk '{printf "%s\\n", $0}')\""
else
  echo "  = POWERSYNC_JWT_PRIVATE_KEY déjà défini (inchangé)"
fi

if ! has MEILI_MASTER_KEY; then
  MEILI="$(openssl rand -hex 24)"
  put MEILI_MASTER_KEY "$MEILI"
  sed -i "/^MEILISEARCH_KEY=/d" "$ENV_FILE"
  printf 'MEILISEARCH_KEY=%s\n' "$MEILI" >>"$ENV_FILE"
  echo "  + MEILISEARCH_KEY aligné sur MEILI_MASTER_KEY"
else
  echo "  = MEILI_MASTER_KEY déjà défini (inchangé)"
fi

if ! has WEBPUSH_VAPID_PRIVATE_KEY; then
  VAPID="$(docker compose run --rm --no-deps -T backend python manage.py generate_vapid_key \
    | sed -n 's/^WEBPUSH_VAPID_PRIVATE_KEY=//p')"
  [ -n "$VAPID" ] && put WEBPUSH_VAPID_PRIVATE_KEY "$VAPID"
else
  echo "  = WEBPUSH_VAPID_PRIVATE_KEY déjà défini (inchangé)"
fi

chmod 600 "$ENV_FILE"
echo
echo "Redémarrage des services…"
docker compose up -d --no-build meilisearch backend celery celery-ai
docker compose up -d --force-recreate nginx
echo "Terminé. Sauvegarde de l'ancien .env : $ENV_FILE.bak.*"
