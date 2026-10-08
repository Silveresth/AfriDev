import { z } from 'zod';

import { rejectSecrets } from './refinements';

export const snippetSchema = z.object({
  title: z.string().trim().min(3).max(120),
  language: z.string().trim().min(1).max(40),
  content: z.string().min(1).max(50_000).superRefine(rejectSecrets),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  isPublic: z.boolean().default(false),
});

export type SnippetInput = z.infer<typeof snippetSchema>;
