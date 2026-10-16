import { z } from 'zod';

/**
 * Réseaux acceptés dans `social_links` et domaines autorisés (miroir de
 * backend/features/profiles/models.py::SOCIAL_NETWORKS). Liste vide : tout domaine https.
 */
export const SOCIAL_NETWORKS = {
  github: ['github.com'],
  gitlab: ['gitlab.com'],
  linkedin: ['linkedin.com'],
  twitter: ['x.com', 'twitter.com'],
  tiktok: ['tiktok.com'],
  instagram: ['instagram.com'],
  youtube: ['youtube.com', 'youtu.be'],
  facebook: ['facebook.com', 'fb.com'],
  dev: ['dev.to'],
  medium: ['medium.com'],
  portfolio: [],
} as const satisfies Record<string, readonly string[]>;

export type SocialNetwork = keyof typeof SOCIAL_NETWORKS;
export const SOCIAL_NETWORK_KEYS = Object.keys(SOCIAL_NETWORKS) as SocialNetwork[];

/** Vrai si `url` est une adresse https sur un domaine accepté pour ce réseau. */
export function isValidSocialLink(network: SocialNetwork, url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const domains: readonly string[] = SOCIAL_NETWORKS[network];
  return domains.length === 0 || domains.some((d) => host === d || host.endsWith(`.${d}`));
}

const socialLinksShape = Object.fromEntries(
  SOCIAL_NETWORK_KEYS.map((network) => [
    network,
    z
      .string()
      .trim()
      .max(200)
      .refine((url) => url === '' || isValidSocialLink(network, url), {
        message:
          SOCIAL_NETWORKS[network].length > 0
            ? `Adresse https://${SOCIAL_NETWORKS[network][0]}/… attendue.`
            : 'Adresse https://… attendue.',
      })
      .optional(),
  ]),
) as Record<SocialNetwork, z.ZodOptional<z.ZodString>>;

export const socialLinksSchema = z.object(socialLinksShape).strict();

/** Corps de PATCH /api/profiles/me/ (noms de champs de l'API). */
export const profileUpdateSchema = z.object({
  display_name: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(600).optional(),
  avatar_url: z.union([z.literal(''), z.string().url()]).optional(),
  banner_url: z.union([z.literal(''), z.string().url()]).optional(),
  social_links: socialLinksSchema.optional(),
  location: z.string().trim().max(80).optional(),
  website: z.union([z.literal(''), z.string().url()]).optional(),
});

export type SocialLinks = z.infer<typeof socialLinksSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
