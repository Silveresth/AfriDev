'use client';

import { GitPullRequestArrow } from 'lucide-react';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { Button, ButtonLink, Dialog, Field, StatusBadge, Textarea, useToast } from '@/shared/ui';

import { useApply, useMyApplications } from '../api';

/** « Proposer ma contribution » : candidature avec un court message au porteur du projet. */
export function ApplyButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { isAuthenticated } = useSession();
  const applications = useMyApplications();
  const apply = useApply(projectId);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  if (!isAuthenticated) {
    return (
      <ButtonLink href={`/login?next=/projects/${projectId}`} variant="secondary" className="w-full">
        <GitPullRequestArrow className="size-4" aria-hidden /> Proposer ma contribution
      </ButtonLink>
    );
  }
  const existing = applications.data?.find((application) => application.project_id === projectId);
  if (existing) {
    const label = { pending: 'Candidature envoyée', accepted: 'Candidature acceptée', declined: 'Candidature déclinée' }[existing.status];
    return (
      <StatusBadge tone={existing.status === 'accepted' ? 'success' : existing.status === 'declined' ? 'neutral' : 'warning'} className="justify-center py-2">
        {label}
      </StatusBadge>
    );
  }

  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <GitPullRequestArrow className="size-4" aria-hidden /> Proposer ma contribution
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Contribuer à ${projectName}`}>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await apply.mutateAsync(message);
              setOpen(false);
              toast('Candidature envoyée au porteur du projet.');
            } catch {
              // erreur affichée ci-dessous
            }
          }}
        >
          <Field label="Message (facultatif)" hint="Votre expérience utile au projet, vos disponibilités…" htmlFor="apply-message">
            <Textarea id="apply-message" value={message} maxLength={1000} onChange={(event) => setMessage(event.target.value)} />
          </Field>
          {apply.isError ? <p className="text-body-sm text-danger">{errorMessage(apply.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" variant="secondary" loading={apply.isPending}>Envoyer</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
