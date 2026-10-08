-- Exécuté une seule fois, à la création du volume Postgres.
CREATE EXTENSION IF NOT EXISTS vector;

-- Publication lue par PowerSync (couvre aussi les tables créées plus tard par les migrations).
CREATE PUBLICATION powersync FOR ALL TABLES;

-- Base de stockage interne de PowerSync (buckets).
CREATE DATABASE powersync_storage;
