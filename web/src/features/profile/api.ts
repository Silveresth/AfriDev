'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, API_URL, unwrap } from '@/shared/api';
import { MY_PROFILE_KEY } from '@/shared/session';

export type PublicProfile = Schemas['PublicProfile'];
export type MyProfile = Schemas['MyProfile'];
export type ProfileUpdate = Schemas['PatchedProfileUpdateRequest'];

export const profileKeys = {
  public: (username: string) => ['profiles', username.toLowerCase()] as const,
};

export function usePublicProfile(username: string, initialData?: PublicProfile) {
  return useQuery({
    queryKey: profileKeys.public(username),
    queryFn: () => unwrap(api.GET('/api/profiles/{username}/', { params: { path: { username } } })),
    initialData,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: ProfileUpdate) => unwrap(api.PATCH('/api/profiles/me/', { body: changes })),
    onSuccess: (profile) => {
      queryClient.setQueryData(MY_PROFILE_KEY, profile);
      void queryClient.invalidateQueries({ queryKey: profileKeys.public(profile.username) });
    },
  });
}

/** Demande une bio à l'IA puis suit la suggestion jusqu'à ce qu'elle soit prête. */
export function useAiBio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      let profile = await unwrap(api.POST('/api/profiles/me/ai-bio/'));
      for (let attempt = 0; profile.ai_bio_status === 'pending' && attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        profile = await unwrap(api.GET('/api/profiles/me/'));
      }
      return profile;
    },
    onSuccess: (profile) => queryClient.setQueryData(MY_PROFILE_KEY, profile),
  });
}

export const qrCodeUrl = (username: string) => `${API_URL}/api/profiles/${encodeURIComponent(username)}/qr.svg`;

export type WorkPreference = Schemas['WorkPreferencesEnum'];
export type Endorsement = Schemas['Endorsement'];
export type GitHubOverview = Schemas['GitHubOverview'];
export type PinnedItem = Schemas['PinnedItem'];
export type PinTargetType = Schemas['PinTargetTypeEnum'];

export const WORK_PREFERENCES: Record<WorkPreference, string> = {
  cdi_remote: 'CDI en télétravail',
  cdi_onsite: 'CDI sur site',
  freelance: 'Freelance',
  mentorat: 'Mentorat',
  stage: 'Stage / alternance',
};

/** Section GitHub : null si aucun compte lié ou GitHub injoignable (la section est masquée). */
export function useGitHubOverview(username: string, enabled: boolean) {
  return useQuery({
    queryKey: ['profiles', username.toLowerCase(), 'github'],
    queryFn: async () => {
      const { data, response } = await api.GET('/api/profiles/{username}/github/', { params: { path: { username } } });
      return response.status === 404 ? null : (data ?? null);
    },
    enabled,
    staleTime: 60 * 60_000,
  });
}

export function useEndorsements(username: string) {
  return useQuery({
    queryKey: ['profiles', username.toLowerCase(), 'endorsements'],
    queryFn: () => unwrap(api.GET('/api/profiles/{username}/endorsements/', { params: { path: { username } } })),
  });
}

/** +1 sur une compétence (ou retrait) ; la liste revient à jour dans la réponse. */
export function useEndorse(username: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skill, endorse }: { skill: string; endorse: boolean }) => {
      const path = { username };
      return unwrap(
        endorse
          ? api.POST('/api/profiles/{username}/endorsements/', { params: { path }, body: { skill } })
          : api.DELETE('/api/profiles/{username}/endorsements/', { params: { path, query: { skill } } }),
      );
    },
    onSuccess: (rows) => queryClient.setQueryData(['profiles', username.toLowerCase(), 'endorsements'], rows),
  });
}

export interface PinCandidate {
  target_type: PinTargetType;
  target_id: string;
  title: string;
}

/** Mes contenus récents, à épingler (première page de chaque type). */
export function usePinCandidates(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['profiles', 'pin-candidates', userId],
    enabled,
    meta: { persist: false },
    queryFn: async (): Promise<PinCandidate[]> => {
      const [posts, questions, snippets, projects] = await Promise.all([
        unwrap(api.GET('/api/feed/', { params: { query: { author: userId, sort: 'new' } } })),
        unwrap(api.GET('/api/qa/questions/', { params: { query: { author: userId } } })),
        unwrap(api.GET('/api/snippets/public/', { params: { query: { author: userId } } })),
        unwrap(api.GET('/api/projects/', { params: { query: { owner: userId } } })),
      ]);
      return [
        ...projects.results.map((p) => ({ target_type: 'project' as const, target_id: p.id, title: p.name })),
        ...snippets.results.map((s) => ({ target_type: 'snippet' as const, target_id: s.id, title: s.title })),
        ...posts.results.map((p) => ({ target_type: 'post' as const, target_id: p.id, title: p.title || p.body.slice(0, 80) })),
        ...questions.results.map((q) => ({ target_type: 'question' as const, target_id: q.id, title: q.title })),
      ];
    },
  });
}

export function useSetPinned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ target_type: PinTargetType; target_id: string }>) =>
      unwrap(api.PUT('/api/profiles/me/pinned/', { body: { items } })),
    onSuccess: (profile) => {
      queryClient.setQueryData(MY_PROFILE_KEY, profile);
      void queryClient.invalidateQueries({ queryKey: profileKeys.public(profile.username) });
    },
  });
}
