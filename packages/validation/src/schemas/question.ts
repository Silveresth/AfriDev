import { z } from 'zod';

import { rejectSecrets } from './refinements';

/** Mêmes règles que features/qa côté backend. */
export const questionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, 'Le titre doit faire au moins 10 caractères.')
    .max(200)
    .superRefine(rejectSecrets),
  body: z.string().trim().min(1, 'Décrivez votre problème.').max(10_000).superRefine(rejectSecrets),
  tags: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
});

export type QuestionInput = z.input<typeof questionSchema>;

export const answerSchema = z.object({
  body: z.string().trim().min(1, 'La réponse est vide.').max(10_000).superRefine(rejectSecrets),
});

export type AnswerInput = z.infer<typeof answerSchema>;
