import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type Schemas, unwrap } from '@/shared/api';
import { MY_PROFILE_KEY } from '@/shared/session';

export type Onboarding = Schemas['Onboarding'];
export type Preferences = Schemas['PreferencesInputRequest'];
export type Suggestions = Schemas['OnboardingSuggestions'];

/** Catalogue de l'accueil (niveaux, objectifs, thématiques, poids du fil) : identique au web. */
export function useOnboarding() {
  return useQuery({ queryKey: ['onboarding'], queryFn: () => unwrap(api.GET('/api/profiles/me/onboarding/')), staleTime: 5 * 60_000 });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Preferences) => unwrap(api.PUT('/api/profiles/me/preferences/', { body })),
    onSuccess: (profile) => {
      queryClient.setQueryData(MY_PROFILE_KEY, profile);
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useSkipOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/profiles/me/onboarding/skip/')),
    onSuccess: (profile) => queryClient.setQueryData(MY_PROFILE_KEY, profile),
  });
}

export function useSuggestions(tags: string[]) {
  return useQuery({
    queryKey: ['onboarding', 'suggestions', tags],
    queryFn: () => unwrap(api.GET('/api/profiles/me/suggestions/', { params: { query: { tags: tags.join(',') } } })),
  });
}
