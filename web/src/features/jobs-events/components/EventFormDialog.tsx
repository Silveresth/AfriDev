'use client';

import { MonitorPlay } from 'lucide-react';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { Button, Dialog, Field, FieldGroup, FormError, Input, Select, TagInput, Textarea, ToggleRow, useToast } from '@/shared/ui';

import { type EventKind, EVENT_KINDS, useEventActions } from '../api';

const EMPTY = {
  title: '',
  kind: 'meetup' as EventKind,
  starts_at: '',
  ends_at: '',
  location: '',
  country: '',
  is_online: false,
  organizer: '',
  registration_url: '',
  description: '',
  tags: [] as string[],
};

/** Valeur d'un champ datetime-local (heure locale) → ISO 8601 avec fuseau. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

export function EventFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useEventActions();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ ...form, starts_at: toIso(form.starts_at)!, ends_at: toIso(form.ends_at) });
      toast('Événement publié.');
      setForm(EMPTY);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Publier un événement" className="w-[min(40rem,calc(100vw-2rem))]">
      <p className="-mt-1 mb-5 text-body-sm text-ink-muted">Annoncez votre meetup, hackathon ou webinar à toute la communauté.</p>
      <form onSubmit={submit} className="space-y-6">
        <FieldGroup title="L'événement">
          <Field label="Titre" htmlFor="event-title" required>
            <Input id="event-title" autoFocus required maxLength={120} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Meetup Python Dakar #13" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="event-kind">
              <Select id="event-kind" value={form.kind} onChange={(e) => set('kind', e.target.value as EventKind)}>
                {Object.entries(EVENT_KINDS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Organisateur" htmlFor="event-organizer" required>
              <Input id="event-organizer" required maxLength={100} value={form.organizer} onChange={(e) => set('organizer', e.target.value)} placeholder="GDG Abidjan" />
            </Field>
          </div>
        </FieldGroup>
        <FieldGroup title="Date et lieu">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Début" htmlFor="event-start" required>
              <Input id="event-start" type="datetime-local" required value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
            </Field>
            <Field label="Fin" htmlFor="event-end">
              <Input id="event-end" type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
            </Field>
          </div>
          <ToggleRow
            icon={<MonitorPlay aria-hidden />}
            title="Événement en ligne"
            description="Pas de lieu à indiquer : le lien d'inscription suffit."
            checked={form.is_online}
            onChange={(value) => set('is_online', value)}
          />
          {!form.is_online ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Lieu" htmlFor="event-location" required>
                <Input id="event-location" required maxLength={150} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Jokkolabs, Dakar" />
              </Field>
              <Field label="Pays" htmlFor="event-country">
                <Input id="event-country" maxLength={60} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Sénégal" />
              </Field>
            </div>
          ) : null}
        </FieldGroup>
        <FieldGroup title="Détails">
          <Field label="Lien d'inscription" htmlFor="event-url" hint="https://…">
            <Input id="event-url" maxLength={300} value={form.registration_url} onChange={(e) => set('registration_url', e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="event-description">
            <Textarea id="event-description" maxLength={6000} value={form.description} onChange={(e) => set('description', e.target.value)} className="min-h-20" />
          </Field>
          <Field label="Technologies" hint="Jusqu'à 8.">
            <TagInput value={form.tags} max={8} onChange={(tags) => set('tags', tags)} />
          </Field>
        </FieldGroup>
        {error ? <FormError>{error}</FormError> : null}
        <div className="-mx-5 -mb-5 flex justify-end gap-2 rounded-b-2xl border-t border-line bg-container-low/60 px-5 py-4">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending}>
            Publier l&apos;événement
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

