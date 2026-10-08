import type { components } from './schema';
import { createApiClient } from './client';

/**
 * Socle réseau commun au web et au mobile : jeton JWT renouvelé automatiquement,
 * format d'erreur unique, envoi de fichiers, suivi des tâches IA.
 * Seul le stockage des jetons dépend de la plateforme (localStorage, SecureStore…).
 */

export interface Tokens {
  access: string;
  refresh: string;
}

export interface TokenStorage {
  get(): string | null;
  getRefresh(): string | null;
  set(tokens: Tokens | null): void;
}

/** Erreur de l'API au format du backend : {"error": {"code", "message", "details"}}. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Pas de réseau : l'action peut être mise en file d'attente. */
  get isNetwork() {
    return this.code === 'network';
  }

  /** Message du premier champ invalide, sinon le message général. */
  get fieldMessage(): string {
    for (const value of Object.values(this.details)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    }
    return this.message;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
  detail?: string;
}

/** ApiError à partir du corps JSON déjà lu ({"error": {...}} ou {"detail": "..."}). */
export function apiErrorFromBody(body: unknown, status: number): ApiError {
  const parsed = (body && typeof body === 'object' ? body : {}) as ErrorBody;
  return new ApiError(
    parsed.error?.message ?? parsed.detail ?? `Erreur ${status}`,
    parsed.error?.code ?? 'error',
    status,
    parsed.error?.details ?? {},
  );
}

export async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = {};
  try {
    body = await response.clone().json();
  } catch {
    // réponse non JSON (proxy, page d'erreur) ou corps déjà lu
  }
  return apiErrorFromBody(body, response.status);
}

export const networkError = () => new ApiError('Pas de connexion au serveur.', 'network', 0);

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.fieldMessage;
  if (error instanceof Error) return error.message;
  return 'Une erreur inattendue est survenue.';
}

type Job = components['schemas']['Job'];

export function createAfriDevClient({
  baseUrl,
  tokens,
  timeoutMs,
}: {
  baseUrl: string;
  tokens: TokenStorage;
  /** Au-delà, la requête est abandonnée (réseau mobile instable) : erreur « network ». */
  timeoutMs?: number;
}) {
  let refreshing: Promise<string | null> | null = null;

  /** Un seul renouvellement à la fois, même si plusieurs requêtes reçoivent un 401. */
  function refreshAccessToken(): Promise<string | null> {
    const refresh = tokens.getRefresh();
    if (!refresh) return Promise.resolve(null);
    refreshing ??= (async () => {
      try {
        const response = await fetch(`${baseUrl}/api/accounts/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        if (!response.ok) {
          tokens.set(null); // session expirée : retour à l'écran de connexion
          return null;
        }
        const data = (await response.json()) as { access: string; refresh?: string };
        tokens.set({ access: data.access, refresh: data.refresh ?? refresh });
        return data.access;
      } catch {
        return null; // hors ligne : la session est gardée pour plus tard
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function send(url: string, init: RequestInit, token: string | null): Promise<Response> {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const controller = timeoutMs ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      return await fetch(url, { ...init, headers, ...(controller ? { signal: controller.signal } : {}) });
    } catch {
      throw networkError();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** fetch authentifié : ajoute le jeton, le renouvelle sur 401 et rejoue la requête une fois. */
  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await send(url, init, tokens.get());
    if (response.status !== 401 || !tokens.getRefresh()) return response;
    const access = await refreshAccessToken();
    return access ? send(url, init, access) : response;
  }

  /** Adaptateur pour openapi-fetch (qui manipule des objets Request). */
  async function authFetch(input: Request): Promise<Response> {
    const hasBody = !['GET', 'HEAD'].includes(input.method);
    return request(input.url, {
      method: input.method,
      headers: input.headers,
      body: hasBody ? await input.text() : undefined,
    });
  }

  const api = createApiClient({ baseUrl, fetch: authFetch });

  /** Déballe une réponse openapi-fetch : renvoie `data` ou lève une ApiError lisible. */
  async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
    const { data, error, response } = await call;
    // openapi-fetch a déjà lu le corps de l'erreur (`error`) : le relire échouerait et le
    // message du serveur (« Identifiants incorrects. »…) serait remplacé par « Erreur 401 ».
    if (error !== undefined) throw apiErrorFromBody(error, response.status);
    if (!response.ok) throw await toApiError(response);
    return data as T;
  }

  /** Requêtes hors schéma typé (envoi de fichiers multipart). */
  async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await request(`${baseUrl}${path}`, init);
    if (!response.ok) throw await toApiError(response);
    return response;
  }

  /** Attend le résultat d'une tâche IA éphémère (reformulation, transcription…). */
  async function waitForJob<T>(
    jobId: string,
    { interval = 800, timeout = 60_000 }: { interval?: number; timeout?: number } = {},
  ): Promise<T> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const job: Job = await unwrap(api.GET('/api/jobs/{job_id}/', { params: { path: { job_id: jobId } } }));
      if (job.status === 'done') return job.result as T;
      if (job.status === 'failed') throw new ApiError(job.error ?? 'La tâche a échoué.', 'job_failed', 200);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new ApiError("L'IA met trop de temps à répondre. Réessayez plus tard.", 'job_timeout', 0);
  }

  return { api, request, authFetch, unwrap, apiFetch, waitForJob };
}

export type AfriDevClient = ReturnType<typeof createAfriDevClient>;
