import type { components, paths } from './schema';

export type { components, paths };

/** Raccourci vers les schémas générés : `Schemas['PostOutput']`. */
export type Schemas = components['schemas'];

export { type ApiClient, type ApiClientOptions, createApiClient } from './client';
export {
  type AfriDevClient,
  ApiError,
  COOKIE_SESSION,
  createAfriDevClient,
  type DirectUploadFile,
  errorMessage,
  networkError,
  toApiError,
  type Tokens,
  type TokenStorage,
} from './runtime';
