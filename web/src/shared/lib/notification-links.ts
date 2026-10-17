/**
 * Lien de l'écran concerné par une notification, d'après data = {type, id}.
 * Module pur (sans React) : partagé par le panneau de notifications et le service worker.
 */
export function notificationHref(data: unknown): string | null {
  const { type, id } = (data ?? {}) as { type?: string; id?: string };
  if (!id) return null;
  switch (type) {
    case 'post':
      return `/feed/${id}`;
    case 'question':
      return `/questions/${id}`;
    case 'snippet':
      return `/snippets/${id}`;
    case 'project':
      return `/projects/${id}`;
    case 'guide':
      return `/projects/guides/${id}`;
    case 'welcome':
      return `/projects/welcome/${id}`;
    case 'profile':
      return `/u/${id}`;
    default:
      return null;
  }
}
