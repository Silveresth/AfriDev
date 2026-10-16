import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, API_URL, type Schemas, unwrap } from '@/shared/api';
import type { Key } from '@/shared/i18n';
import { useInfiniteList } from '@/shared/query';
import { MY_PROFILE_KEY } from '@/shared/session';

export type PublicProfile = Schemas['PublicProfile'];
export type MyProfile = Schemas['MyProfile'];
export type ProfileUpdate = Schemas['PatchedProfileUpdateRequest'];
export type WorkPreference = Schemas['WorkPreferencesEnum'];
export type PinTargetType = Schemas['PinTargetTypeEnum'];
export type PublicSnippet = Schemas['PublicSnippet'];
export type Project = Schemas['ProjectOutput'];

/** Formes de collaboration : clé de traduction de chaque code. */
export const WORK_PREFERENCES: Record<WorkPreference, Key> = {
  cdi_remote: 'work.cdi_remote',
  cdi_onsite: 'work.cdi_onsite',
  freelance: 'work.freelance',
  mentorat: 'work.mentorat',
  stage: 'work.stage',
};

export const profileKeys = {
  public: (username: string) => ['profiles', username.toLowerCase()] as const,
};

export const qrCodeUrl = (username: string) => `${API_URL}/api/profiles/${encodeURIComponent(username)}/qr.svg`;

export function usePublicProfile(username: string) {
  return useQuery({
    queryKey: profileKeys.public(username),
    queryFn: () => unwrap(api.GET('/api/profiles/{username}/', { params: { path: { username } } })),
    enabled: Boolean(username),
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

/** Section GitHub : null si aucun compte lié ou GitHub injoignable (la section est masquée). */
export function useGitHubOverview(username: string, enabled: boolean) {
  return useQuery({
    queryKey: ['profiles', username.toLowerCase(), 'github'],
    queryFn: async () => {
      const { data, response } = await api.GET('/api/profiles/{username}/github/', { params: { path: { username } } });
      return response.ok ? (data ?? null) : null;
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
    mutationFn: (items: { target_type: PinTargetType; target_id: string }[]) =>
      unwrap(api.PUT('/api/profiles/me/pinned/', { body: { items } })),
    onSuccess: (profile) => {
      queryClient.setQueryData(MY_PROFILE_KEY, profile);
      void queryClient.invalidateQueries({ queryKey: profileKeys.public(profile.username) });
    },
  });
}

export type FollowListItem = Schemas['FollowListItem'];
export type HelpAnswer = Schemas['HelpAnswer'];

/** Suivre / ne plus suivre, en optimiste (bouton et compteur changent tout de suite). */
export function useFollow(username: string) {
  const queryClient = useQueryClient();
  const key = profileKeys.public(username);
  return useMutation({
    mutationFn: (follow: boolean) =>
      unwrap(
        follow
          ? api.POST('/api/profiles/{username}/follow/', { params: { path: { username } } })
          : api.POST('/api/profiles/{username}/unfollow/', { params: { path: { username } } }),
      ),
    onMutate: async (follow) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PublicProfile>(key);
      if (previous && previous.is_following !== follow) {
        queryClient.setQueryData<PublicProfile>(key, {
          ...previous,
          is_following: follow,
          followers_count: Math.max(0, previous.followers_count + (follow ? 1 : -1)),
        });
      }
      return { previous };
    },
    onError: (_error, _follow, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (state) => {
      queryClient.setQueryData<PublicProfile>(key, (current) =>
        current ? { ...current, is_following: state.is_following, followers_count: state.followers_count } : current,
      );
      void queryClient.invalidateQueries({ queryKey: MY_PROFILE_KEY });
      void queryClient.invalidateQueries({ queryKey: ['profiles', 'follows'] });
    },
  });
}

export function useFollowList(username: string, kind: 'followers' | 'following', enabled: boolean) {
  return useInfiniteList(
    ['profiles', 'follows', username.toLowerCase(), kind],
    (cursor) =>
      unwrap(
        kind === 'followers'
          ? api.GET('/api/profiles/{username}/followers/', { params: { path: { username }, query: { cursor } } })
          : api.GET('/api/profiles/{username}/following/', { params: { path: { username }, query: { cursor } } }),
      ),
    { enabled },
  );
}

/** Réponses d'un membre avec le titre de la question (onglet « Q&A & Entraide »). */
export function useAuthorAnswers(author: string, accepted: boolean | undefined, enabled: boolean) {
  return useInfiniteList(
    ['qa', 'answers-by-author', author, accepted ?? null],
    (cursor) => unwrap(api.GET('/api/qa/answers/', { params: { query: { cursor, author, accepted } } })),
    { enabled },
  );
}

export function useSnippetsByAuthor(authorId: string, enabled: boolean) {
  return useInfiniteList(
    ['snippets', 'public', 'author', authorId],
    (cursor) => unwrap(api.GET('/api/snippets/public/', { params: { query: { cursor, author: authorId } } })),
    { enabled },
  );
}

export function useProjectsByOwner(ownerId: string, enabled: boolean) {
  return useInfiniteList(
    ['projects', 'list', { owner: ownerId }],
    (cursor) => unwrap(api.GET('/api/projects/', { params: { query: { cursor, owner: ownerId } } })),
    { enabled },
  );
}
