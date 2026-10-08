/**
 * Ouverture de la palette de recherche (⌘K / Ctrl+K) depuis n'importe quel bouton du cadre.
 * La palette elle-même vit dans features/search : shared/ ne fait qu'émettre l'événement.
 */
export const OPEN_COMMAND_EVENT = 'afridev:open-command';

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_EVENT));
}

/** « ⌘ » sur Mac/iOS, « Ctrl » ailleurs (calculé côté client uniquement). */
export function modifierKeyLabel() {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
}
