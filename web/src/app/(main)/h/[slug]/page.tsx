import type { Schemas } from '@afridev/api-client';
import type { Metadata } from 'next';

import { HubPosts } from '@/features/feed';
import { HubScreen } from '@/features/hubs';
import { HubQuestions } from '@/features/qa';
import { HubSnippets } from '@/features/snippets';
import { serverGet } from '@/shared/api/server';

type Props = { params: Promise<{ slug: string }> };

const getHub = (slug: string) => serverGet<Schemas['HubOutput']>(`/api/hubs/${encodeURIComponent(slug)}/`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const hub = await getHub((await params).slug);
  if (!hub) return { title: 'Hub' };
  return {
    title: `${hub.name} (h/${hub.slug})`,
    description: hub.description || `La communauté ${hub.name} sur AfriDev Exchange.`,
    openGraph: { title: hub.name, type: 'website' },
  };
}

/** Page publique d'un hub : en-tête rendu côté serveur, listes chargées par chaque feature. */
export default async function HubPage({ params }: Props) {
  const { slug } = await params;
  const hub = await getHub(slug);
  return (
    <HubScreen
      slug={slug}
      initial={hub ?? undefined}
      posts={<HubPosts hub={slug} />}
      questions={<HubQuestions hub={slug} />}
      snippets={<HubSnippets hub={slug} />}
    />
  );
}
