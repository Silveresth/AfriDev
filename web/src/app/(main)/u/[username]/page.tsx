import type { Schemas } from '@afridev/api-client';
import type { Metadata } from 'next';

import { ProfileScreen } from '@/features/profile';
import { serverGet } from '@/shared/api/server';

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ welcome?: string }>;
};

const getProfile = (username: string) =>
  serverGet<Schemas['PublicProfile']>(`/api/profiles/${encodeURIComponent(username)}/`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile((await params).username);
  if (!profile) return { title: 'Profil' };
  const name = profile.display_name || profile.username;
  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio || `Profil développeur de ${name} sur AfriDev Exchange.`,
  };
}

/** Profil public : cible du QR code, rendu côté serveur. */
export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { welcome } = await searchParams;
  const profile = await getProfile(username);
  return <ProfileScreen username={username} initial={profile ?? undefined} welcome={welcome === '1'} />;
}
