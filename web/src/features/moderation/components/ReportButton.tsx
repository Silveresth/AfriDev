'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { useState } from 'react';

import { api, errorMessage, unwrap } from '@/shared/api';
import { useSession } from '@/shared/session';
import { Button, Dialog, Field, pillAction, Textarea, useToast } from '@/shared/ui';

type TargetType = Schemas['TargetTypeEnum'];
type Reason = Schemas['ReasonEnum'];

const REASONS: Array<{ value: Reason; label: string }> = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'scam', label: 'Arnaque (faux recrutement, paiement suspect…)' },
  { value: 'abuse', label: 'Harcèlement ou propos haineux' },
  { value: 'secret', label: 'Donnée sensible exposée' },
  { value: 'off_topic', label: 'Hors sujet' },
  { value: 'other', label: 'Autre' },
];

/** compact : icône seule (barre d'actions d'un post). */
export function ReportButton({
  targetType,
  targetId,
  compact = false,
}: {
  targetType: TargetType;
  targetId: string;
  compact?: boolean;
}) {
  const { isAuthenticated } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>('spam');
  const [details, setDetails] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/api/moderation/reports/', { body: { target_type: targetType, target_id: targetId, reason, details } })),
    onSuccess: () => {
      setOpen(false);
      toast('Merci, la modération va examiner ce contenu.');
    },
  });

  if (!isAuthenticated) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Signaler"
        title="Signaler"
        className={compact ? `${pillAction} px-1.5 sm:px-2` : pillAction}
      >
        <Flag className="size-4" aria-hidden /> {compact ? null : 'Signaler'}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Signaler ce contenu">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <fieldset className="space-y-1">
            <legend className="mb-2 font-semibold">Motif</legend>
            {REASONS.map((option) => (
              <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 hover:bg-container">
                <input
                  type="radio"
                  name="reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  className="size-5 accent-[var(--primary)]"
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <Field label="Précisions (facultatif)" htmlFor="report-details">
            <Textarea id="report-details" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          {mutation.isError ? <p className="text-body-sm text-danger">{errorMessage(mutation.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" loading={mutation.isPending}>Envoyer le signalement</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
