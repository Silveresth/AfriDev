import { z } from 'zod';

import { rejectSecrets } from './refinements';

/**
 * Lien externe d'un post (même règle que feed.services.clean_link) : '' si vide, l'adresse
 * complétée en https:// si besoin, ou null si elle n'est pas une adresse web valable.
 */
export function normalizeLink(value: string): string | null {
  const raw = value.trim();
  if (!raw) return '';
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  if (url.length > 500 || /\s/.test(url)) return null;
  const match = url.match(/^https?:\/\/([^/?#]+)/i);
  const host = match?.[1] ?? '';
  if (!host || host.includes('@') || !/^[\w.-]+\.[a-z]{2,}(:\d+)?$/i.test(host)) return null;
  return url;
}

/** Domaine affiché sous un lien : « github.com ». */
export function linkDomain(url: string): string {
  return url.match(/^https?:\/\/(?:www\.)?([^/?#:]+)/i)?.[1] ?? '';
}

/** Mêmes règles que features/feed côté backend. */
export const postSchema = z
  .object({
    kind: z.enum(['text', 'image', 'poll', 'short']),
    // Titre façon Reddit (requis par le formulaire web ; l'app mobile n'en envoie pas encore).
    title: z.string().trim().max(200).default('').superRefine(rejectSecrets),
    body: z.string().trim().max(3_000).superRefine(rejectSecrets),
    pollOptions: z.array(z.string().trim().min(1).max(80)).max(4).default([]),
    mediaId: z.uuid().nullish(),
    // Ressource externe facultative : la carte du post y mène.
    linkUrl: z
      .string()
      .default('')
      .transform((value, ctx) => {
        const link = normalizeLink(value);
        if (link === null) {
          ctx.addIssue({ code: 'custom', message: 'Lien invalide : indiquez une adresse web complète (https://…).' });
          return z.NEVER;
        }
        return link;
      }),
    tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  })
  .superRefine((post, ctx) => {
    if (post.kind === 'poll' && (post.pollOptions.length < 2 || !(post.title || post.body))) {
      ctx.addIssue({ code: 'custom', message: 'Un sondage a besoin d’une question et de 2 à 4 choix.' });
    }
    if ((post.kind === 'image' || post.kind === 'short') && !post.mediaId) {
      ctx.addIssue({ code: 'custom', message: 'Ajoutez le média avant de publier.' });
    }
    if (post.kind === 'text' && !post.title && !post.body) {
      ctx.addIssue({ code: 'custom', message: 'Le post est vide.' });
    }
  });

export type PostInput = z.input<typeof postSchema>;

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Le commentaire est vide.').max(2_000).superRefine(rejectSecrets),
});
