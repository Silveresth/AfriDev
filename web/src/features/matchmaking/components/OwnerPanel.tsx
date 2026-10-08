'use client';

import { Check, Users, X } from 'lucide-react';
import Link from 'next/link';

import { Avatar, Button, Card, StatusBadge, Tag, TimeAgo } from '@/shared/ui';

import { useAnswerApplication, useCandidates, useProjectApplications } from '../api';

/** Vue du porteur : candidatures reçues et développeurs recommandés pour son projet. */
export function OwnerPanel({ projectId }: { projectId: string }) {
  const applications = useProjectApplications(projectId, true);
  const candidates = useCandidates(projectId, true);
  const answer = useAnswerApplication(projectId);

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-headline-md">
          <Users className="size-5 text-secondary-ink" aria-hidden /> Candidatures reçues
        </h2>
        {applications.data?.length ? (
          <ul className="space-y-2">
            {applications.data.map((application) => (
              <li key={application.id} className="space-y-2 rounded-lg border border-line bg-container-low p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Avatar name={application.candidate?.display_name ?? 'Membre'} src={application.candidate?.avatar_url} size={28} />
                    <span className="text-body-sm">
                      {application.candidate ? (
                        <Link href={`/u/${application.candidate.username}`} className="font-semibold text-ink hover:underline">
                          {application.candidate.display_name}
                        </Link>
                      ) : (
                        'Membre'
                      )}
                      <TimeAgo date={application.created_at} className="ml-2 text-label-md text-ink-faint" />
                    </span>
                  </span>
                  {application.status === 'pending' ? (
                    <span className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => answer.mutate({ id: application.id, accept: true })}>
                        <Check className="size-4" aria-hidden /> Accepter
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => answer.mutate({ id: application.id, accept: false })}>
                        <X className="size-4" aria-hidden /> Décliner
                      </Button>
                    </span>
                  ) : (
                    <StatusBadge tone={application.status === 'accepted' ? 'success' : 'neutral'}>
                      {application.status === 'accepted' ? 'Acceptée' : 'Déclinée'}
                    </StatusBadge>
                  )}
                </div>
                {application.message ? <p className="text-body-sm text-ink">{application.message}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-ink-muted">Aucune candidature pour l&apos;instant.</p>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-headline-md">Développeurs recommandés</h2>
        {candidates.data?.length ? (
          <ul className="space-y-2">
            {candidates.data.slice(0, 6).map(({ candidate, score, matched }) => (
              <li key={candidate.id} className="flex items-start gap-3">
                <Avatar name={candidate.display_name} src={candidate.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${candidate.username}`} className="font-semibold text-ink hover:underline">
                    {candidate.display_name}
                  </Link>
                  <p className="text-label-md text-secondary-ink">{Math.round(score * 100)} % d&apos;affinité</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {matched.map((skill) => (
                      <Tag key={skill} hash={false}>{skill}</Tag>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-ink-muted">
            Ajoutez les technologies du projet pour recevoir des suggestions de profils.
          </p>
        )}
      </Card>
    </div>
  );
}
