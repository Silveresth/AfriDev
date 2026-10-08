import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Fusion de classes Tailwind : la dernière l'emporte en cas de conflit
 * (`cn('min-h-28', 'min-h-11')` → `min-h-11`), pour surcharger proprement un composant.
 * Nos tailles de texte et ombres sont déclarées, sinon `text-body-md` serait prise pour une couleur.
 */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['headline-xl', 'headline-lg', 'headline-md', 'body-lg', 'body-md', 'body-sm', 'code', 'label-md', 'label-sm'],
      shadow: ['card', 'raised'],
    },
  },
});

export function cn(...classes: Array<string | false | null | undefined>): string {
  return merge(classes.filter(Boolean).join(' '));
}
