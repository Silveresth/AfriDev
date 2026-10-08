import type { Schemas } from '@afridev/api-client';
import type { Metadata } from 'next';

import { PostDetail } from '@/features/feed';
import { serverGet } from '@/shared/api/server';

type Props = { params: Promise<{ id: string }> };

const getPost = (id: string) => serverGet<Schemas['PostOutput']>(`/api/feed/${encodeURIComponent(id)}/`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).id);
  if (!post) return { title: 'Post' };
  const author = post.author?.display_name ?? 'Un membre';
  return {
    title: post.title || `${author} sur AfriDev`,
    description: (post.title ? post.body : post.body.slice(0, 160)).slice(0, 160) || undefined,
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPost(id);
  return <PostDetail id={id} initial={post ?? undefined} />;
}
