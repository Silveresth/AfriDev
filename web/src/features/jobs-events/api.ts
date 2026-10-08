'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { useInfiniteList } from '@/shared/query';

export type Job = Schemas['JobOutput'];
export type JobInput = Schemas['JobInputRequest'];
export type ContractType = Schemas['ContractTypeEnum'];
export type TechEvent = Schemas['EventOutput'];
export type EventInput = Schemas['EventInputRequest'];
export type EventKind = Schemas['EventKindEnum'];

export const CONTRACTS: Record<ContractType, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  freelance: 'Freelance',
  stage: 'Stage',
  alternance: 'Alternance',
  temps_partiel: 'Temps partiel',
};

export const EVENT_KINDS: Record<EventKind, string> = {
  meetup: 'Meetup',
  hackathon: 'Hackathon',
  webinar: 'Webinar',
  conference: 'Conférence',
  atelier: 'Atelier',
};

export interface JobFilters {
  q?: string;
  country?: string;
  tech?: string;
  remote?: boolean;
  contract?: ContractType;
  author?: string;
}

export interface EventFilters {
  q?: string;
  country?: string;
  tech?: string;
  kind?: EventKind;
  online?: boolean;
  past?: boolean;
}

const keys = {
  jobs: (filters: JobFilters) => ['jobs', 'list', filters] as const,
  jobFacets: ['jobs', 'facets'] as const,
  events: (filters: EventFilters) => ['events', 'list', filters] as const,
  eventFacets: ['events', 'facets'] as const,
};

export function useJobs(filters: JobFilters = {}) {
  return useInfiniteList(keys.jobs(filters), (cursor) =>
    unwrap(api.GET('/api/job-board/', { params: { query: { cursor, ...filters } } })),
  );
}

export function useJobFacets() {
  return useQuery({
    queryKey: keys.jobFacets,
    queryFn: () => unwrap(api.GET('/api/job-board/facets/')),
    staleTime: 10 * 60_000,
  });
}

export function useJobActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['jobs'] });
  const create = useMutation({
    mutationFn: (body: JobInput) => unwrap(api.POST('/api/job-board/', { body })),
    onSuccess: refresh,
  });
  const close = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      unwrap(api.PATCH('/api/job-board/{job_id}/', { params: { path: { job_id: id } }, body: { is_active: active } })),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/job-board/{job_id}/', { params: { path: { job_id: id } } })),
    onSuccess: refresh,
  });
  return { create, close, remove };
}

export function useEvents(filters: EventFilters = {}) {
  return useInfiniteList(keys.events(filters), (cursor) =>
    unwrap(api.GET('/api/events/', { params: { query: { cursor, ...filters } } })),
  );
}

export function useEventFacets() {
  return useQuery({
    queryKey: keys.eventFacets,
    queryFn: () => unwrap(api.GET('/api/events/facets/')),
    staleTime: 10 * 60_000,
  });
}

export function useEventActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['events'] });
  const create = useMutation({
    mutationFn: (body: EventInput) => unwrap(api.POST('/api/events/', { body })),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/events/{event_id}/', { params: { path: { event_id: id } } })),
    onSuccess: refresh,
  });
  return { create, remove };
}
