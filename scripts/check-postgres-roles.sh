#!/usr/bin/env bash
set -eo pipefail

echo "==> [DB Guard] Vérification des permissions du rôle 'postgres'..."

# Test si le rôle postgres peut se connecter
CAN_LOGIN=$(docker exec afridev-postgres-1 psql -U postgres -d postgres -tAc \
  "SELECT rolcanlogin AND rolsuper FROM pg_roles WHERE rolname = 'postgres';" 2>/dev/null || echo "error")

if [ "$CAN_LOGIN" = "t" ]; then
  echo "==> [DB Guard] OK : Le rôle 'postgres' possède bien les droits LOGIN et SUPERUSER."
else
  echo "⚠️ ==> [DB Guard] ANOMALIE DÉTECTÉE : Le rôle 'postgres' n'a pas les droits requis (retour: $CAN_LOGIN)."
  echo "==> [DB Guard] Application de l'auto-remédiation..."

  # Tentative de correction via psql local
  docker exec afridev-postgres-1 psql -U postgres -d postgres -c \
    "ALTER ROLE postgres WITH LOGIN SUPERUSER;" 2>/dev/null || true

  # Si la connexion socket échoue (ex: rolcanlogin est false), correction forcée via single-user mode
  VERIF=$(docker exec afridev-postgres-1 psql -U postgres -d postgres -tAc \
    "SELECT rolcanlogin AND rolsuper FROM pg_roles WHERE rolname = 'postgres';" 2>/dev/null || echo "f")

  if [ "$VERIF" != "t" ]; then
    echo "==> [DB Guard] Correction d'urgence en mode single-user..."
    docker stop afridev-postgres-1
    docker run --rm -i -u postgres -v afridev_postgres-data:/var/lib/postgresql/data pgvector/pgvector:pg17 \
      /usr/lib/postgresql/17/bin/postgres --single -D /var/lib/postgresql/data -c wal_level=logical postgres <<'EOF'
UPDATE pg_authid SET rolcanlogin = true, rolsuper = true WHERE rolname = 'postgres';
EOF
    docker start afridev-postgres-1
    # Attente que postgres soit de nouveau prêt
    until docker exec afridev-postgres-1 pg_isready -U postgres; do sleep 1; done
  fi

  echo "==> [DB Guard] SUCCÈS : Les permissions du rôle 'postgres' ont été restaurées avec succès !"
fi
