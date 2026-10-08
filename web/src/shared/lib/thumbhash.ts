import { thumbHashToDataURL } from 'thumbhash';

/** Aperçu flou (~25 octets encodés en base64 par le backend) -> image data: affichable tout de suite. */
export function thumbhashToDataUrl(hash: string | null | undefined): string | undefined {
  if (!hash) return undefined;
  try {
    const bytes = Uint8Array.from(atob(hash), (char) => char.charCodeAt(0));
    return thumbHashToDataURL(bytes);
  } catch {
    return undefined;
  }
}
