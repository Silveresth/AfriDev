-- Exécuté à l'initialisation du volume Postgres.
CREATE EXTENSION IF NOT EXISTS vector;

-- Sécurise les privilèges de connexion pour le rôle postgres
ALTER ROLE postgres WITH LOGIN SUPERUSER;

-- Publication lue par PowerSync (couvre aussi les tables créées plus tard par les migrations).
CREATE PUBLICATION powersync FOR ALL TABLES;

-- Base de stockage interne de PowerSync (buckets).
CREATE DATABASE powersync_storage;
