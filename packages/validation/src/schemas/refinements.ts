import type { z } from 'zod';

import { scanForSecrets } from '../security-guard';

/** Bloque l'envoi d'un texte contenant un secret (utilisé dans les schémas Zod). */
export function rejectSecrets(value: string, ctx: z.RefinementCtx): void {
  const [first] = scanForSecrets(value);
  if (first) {
    ctx.addIssue({
      code: 'custom',
      message: `Secret détecté (${first.description}) à la ligne ${first.line}. Retirez-le avant l'envoi.`,
    });
  }
}
