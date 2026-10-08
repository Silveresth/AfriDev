export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
export const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL ?? '';
/** WebSocket du backend (commentaires et notifications en direct). */
export const WS_URL = API_URL.replace(/^http/, 'ws');
export const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? '';
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
export const GITLAB_CLIENT_ID = process.env.NEXT_PUBLIC_GITLAB_CLIENT_ID ?? '';
export const GITLAB_URL = process.env.NEXT_PUBLIC_GITLAB_URL ?? 'https://gitlab.com';
