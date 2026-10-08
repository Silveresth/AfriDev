import { column, Schema, Table } from '@powersync/common';

/**
 * Schéma de la copie locale (SQLite) synchronisée par PowerSync.
 * Chaque table reçoit automatiquement une colonne `id` (UUID, identique à Django).
 * Les noms de tables correspondent aux alias définis dans infra/powersync/sync-rules.yaml.
 * Les brouillons ne sont PAS ici : ils restent purement locaux (shared/drafts).
 */

const profiles = new Table({
  username: column.text,
  display_name: column.text,
  bio: column.text,
  avatar_url: column.text,
  stack: column.text, // JSON
  updated_at: column.text,
});

const posts = new Table(
  {
    author_id: column.text,
    kind: column.text,
    body: column.text,
    poll_options: column.text, // JSON
    media_id: column.text,
    hub_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_created: ['created_at'] } },
);

const comments = new Table(
  {
    post_id: column.text,
    author_id: column.text,
    body: column.text,
    created_at: column.text,
  },
  { indexes: { by_post: ['post_id'] } },
);

const questions = new Table(
  {
    author_id: column.text,
    title: column.text,
    body: column.text,
    tags: column.text, // JSON
    ai_answer: column.text,
    hub_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_created: ['created_at'] } },
);

const answers = new Table(
  {
    question_id: column.text,
    author_id: column.text,
    body: column.text,
    is_accepted: column.integer,
    created_at: column.text,
  },
  { indexes: { by_question: ['question_id'] } },
);

const snippets = new Table(
  {
    owner_id: column.text,
    title: column.text,
    language: column.text,
    content: column.text,
    tags: column.text, // JSON
    is_public: column.integer,
    hub_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_owner: ['owner_id'] } },
);

const projects = new Table({
  owner_id: column.text,
  name: column.text,
  description: column.text,
  repo_url: column.text,
  tags: column.text, // JSON
  updated_at: column.text,
});

export const AppSchema = new Schema({
  profiles,
  posts,
  comments,
  questions,
  answers,
  snippets,
  projects,
});

export type Database = (typeof AppSchema)['types'];
export type PostRecord = Database['posts'];
export type QuestionRecord = Database['questions'];
export type AnswerRecord = Database['answers'];
export type SnippetRecord = Database['snippets'];
export type ProjectRecord = Database['projects'];
export type ProfileRecord = Database['profiles'];
