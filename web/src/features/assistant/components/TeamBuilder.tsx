'use client';

import { Briefcase, Send, Sparkles, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { Avatar, Button, Card, Dialog, Tag, Textarea, useToast } from '@/shared/ui';

import { type TeamCandidate, useInviteTeammate, useTeamSuggestions } from '../api';

/** Porteur de projet : l'IA propose des coéquipiers complémentaires et rédige l'invitation. */
export function TeamBuilder({ projectId }: { projectId: string }) {
  const suggestions = useTeamSuggestions();
  const [inviting, setInviting] = useState<TeamCandidate | null>(null);
  const result = suggestions.data;

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-headline-md text-ink">
            <UsersRound className="size-5 text-primary-ink" aria-hidden /> Constituer l’équipe
          </h2>
          <p className="text-body-sm text-ink-muted">L’IA propose des membres complémentaires selon la stack, la disponibilité et la localisation.</p>
        </div>
        <Button size="sm" onClick={() => suggestions.mutate(projectId)} loading={suggestions.isPending}>
          <Sparkles className="size-4" aria-hidden /> {result ? 'Nouvelles propositions' : 'Trouver des coéquipiers'}
        </Button>
      </div>
      {suggestions.isError ? <p className="text-body-sm text-danger">{errorMessage(suggestions.error)}</p> : null}
      {result ? (
        result.candidates.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {result.candidates.map((candidate) => (
              <li key={candidate.username} className="flex flex-wrap items-center gap-3 p-3.5">
                <Link href={`/u/${candidate.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={candidate.display_name} src={candidate.avatar_url} size={44} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-ink">
                      {candidate.display_name}
                      {candidate.open_to_work ? <Briefcase className="size-3.5 text-secondary" aria-label="Disponible" /> : null}
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-label-sm font-bold text-primary-ink">{candidate.fit}%</span>
                    </span>
                    <span className="block text-body-sm text-ink-muted">
                      {candidate.role} · {candidate.reason}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {candidate.stack.map((tech) => (
                        <Tag key={tech}>{tech}</Tag>
                      ))}
                    </span>
                  </span>
                </Link>
                <Button size="sm" variant="outline" onClick={() => setInviting(candidate)}>
                  <Send className="size-3.5" aria-hidden /> Inviter
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-ink-muted">Aucun membre ne correspond encore aux technologies du projet. Ajoutez des tags au projet pour élargir la recherche.</p>
        )
      ) : null}
      {inviting && result ? (
        <InviteDialog
          projectId={projectId}
          candidate={inviting}
          draft={result.invitation.replaceAll('{prenom}', inviting.display_name.split(' ')[0] ?? inviting.display_name)}
          onClose={() => setInviting(null)}
        />
      ) : null}
    </Card>
  );
}

function InviteDialog({ projectId, candidate, draft, onClose }: { projectId: string; candidate: TeamCandidate; draft: string; onClose: () => void }) {
  const invite = useInviteTeammate();
  const toast = useToast();
  const [message, setMessage] = useState(draft);
  return (
    <Dialog open onClose={onClose} title={`Inviter ${candidate.display_name}`}>
      <p className="mb-3 text-body-sm text-ink-muted">Envoyé en message privé, avec le lien du projet. {candidate.display_name} reçoit aussi une notification.</p>
      <Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1500} className="min-h-32" />
      {invite.isError ? <p className="mt-2 text-body-sm text-danger">{errorMessage(invite.error)}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button
          loading={invite.isPending}
          onClick={() =>
            invite.mutate(
              { project_id: projectId, username: candidate.username, message },
              {
                onSuccess: () => {
                  toast(`Invitation envoyée à ${candidate.display_name}.`);
                  onClose();
                },
              },
            )
          }
        >
          <Send className="size-4" aria-hidden /> Envoyer
        </Button>
      </div>
    </Dialog>
  );
}
