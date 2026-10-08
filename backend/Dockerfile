# backend/Dockerfile
FROM python:3.12-slim AS base

# Empêcher Python d'écrire des fichiers .pyc et forcer l'affichage direct des logs
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

# Dépendances système pour psycopg et extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Installation de uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copie de la définition du projet et installation des dépendances
COPY pyproject.toml ./
RUN uv sync --no-dev

# Copie du code source
COPY . ./

# Règles anti-secrets partagées avec le web et le mobile (packages/validation), hors du contexte
# ./backend : fournies par docker-compose (additional_contexts) ou par
# `docker build --build-context security-guard=packages/validation/src/security-guard backend`.
COPY --from=security-guard rules.json /app/security-guard/rules.json
ENV SECURITY_GUARD_RULES_PATH=/app/security-guard/rules.json

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# Commande par défaut : serveur ASGI Daphne (support WebSockets + HTTP)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
