'use client';

import type { Schemas } from '@afridev/api-client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { useInfiniteList } from '@/shared/query';

export type Dashboard = Schemas['Dashboard'];
export type ModerationReport = Schemas['ModerationReport'];
export type ReportStatus = Schemas['ReportStatusEnum'];
export type Member = Schemas['Member'];
export type Period = 7 | 30 | 90;

// Données de l'équipe (e-mails, téléphones, signalements) : jamais gardées dans la copie
// locale du navigateur (meta.persist = false), contrairement au reste de l'application.
const PRIVATE = { persist: false } as const;

export const backofficeKeys = {
  all: ['backoffice'] as const,
  dashboard: (days: Period) => ['backoffice', 'dashboard', days] as const,
  reports: (filters: ReportFilters) => ['backoffice', 'reports', filters] as const,
  members: (filters: MemberFilters) => ['backoffice', 'members', filters] as const,
};

export function useDashboard(days: Period) {
  return useQuery({
    queryKey: backofficeKeys.dashboard(days),
    queryFn: () => unwrap(api.GET('/api/backoffice/dashboard/', { params: { query: { days } } })),
    meta: PRIVATE,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export interface ReportFilters {
  status: ReportStatus;
  target_type?: Schemas['TargetTypeEnum'];
  source?: 'ai' | 'member';
}

export function useReports(filters: ReportFilters) {
  return useInfiniteList(
    backofficeKeys.reports(filters),
    (cursor) => unwrap(api.GET('/api/moderation/reports/', { params: { query: { cursor, ...filters } } })),
    PRIVATE,
  );
}

/** Nombre de signalements à traiter (pastille du menu). */
export function useOpenReportCount() {
  const dashboard = useQuery({
    queryKey: backofficeKeys.dashboard(30),
    queryFn: () => unwrap(api.GET('/api/backoffice/dashboard/', { params: { query: { days: 30 } } })),
    meta: PRIVATE,
    refetchInterval: 60_000,
  });
  return dashboard.data?.moderation.open;
}

export type ModerationAction = 'hide' | 'dismiss' | 'restore';

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: ModerationAction }) =>
      unwrap(
        api.POST('/api/moderation/reports/{report_id}/resolve/', {
          params: { path: { report_id: id } },
          body: { action },
        }),
      ),
    // Les autres signalements du même contenu changent aussi de statut : on recharge tout.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: backofficeKeys.all }),
  });
}

export interface MemberFilters {
  q?: string;
  role?: 'staff' | 'suspended';
}

export function useMembers(filters: MemberFilters) {
  return useInfiniteList(
    backofficeKeys.members(filters),
    (cursor) => unwrap(api.GET('/api/backoffice/members/', { params: { query: { cursor, ...filters } } })),
    PRIVATE,
  );
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: { is_active?: boolean; is_staff?: boolean } }) =>
      unwrap(api.PATCH('/api/backoffice/members/{user_id}/', { params: { path: { user_id: id } }, body: changes })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: backofficeKeys.all }),
  });
}
