'use client';

import { Globe2 } from 'lucide-react';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { Button, Dialog, Field, FieldGroup, FormError, Input, Select, TagInput, Textarea, ToggleRow, useToast } from '@/shared/ui';

import { type ContractType, CONTRACTS, useJobActions } from '../api';

const EMPTY = {
  title: '',
  company: '',
  location: '',
  country: '',
  is_remote: false,
  contract_type: 'cdi' as ContractType,
  description: '',
  apply_url: '',
  stack: [] as string[],
  salary_range: '',
};

export function JobFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useJobActions();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await create.mutateAsync(form);
      toast('Offre publiée sur le Job Board.');
      setForm(EMPTY);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Publier une offre" className="w-[min(40rem,calc(100vw-2rem))]">
      <p className="-mt-1 mb-5 text-body-sm text-ink-muted">Gratuit, et visible tout de suite sur le Job Board.</p>
      <form onSubmit={submit} className="space-y-6">
        <FieldGroup title="Le poste">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Intitulé du poste" htmlFor="job-title" required>
              <Input id="job-title" autoFocus required maxLength={120} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Développeur·se React Native" />
            </Field>
            <Field label="Entreprise" htmlFor="job-company" required>
              <Input id="job-company" required maxLength={100} value={form.company} onChange={(e) => set('company', e.target.value)} />
            </Field>
            <Field label="Contrat" htmlFor="job-contract">
              <Select id="job-contract" value={form.contract_type} onChange={(e) => set('contract_type', e.target.value as ContractType)}>
                {Object.entries(CONTRACTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rémunération" htmlFor="job-salary" hint="Facultatif, mais apprécié.">
              <Input id="job-salary" maxLength={80} value={form.salary_range} onChange={(e) => set('salary_range', e.target.value)} placeholder="800 000 – 1 200 000 FCFA / mois" />
            </Field>
          </div>
        </FieldGroup>
        <FieldGroup title="Lieu">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ville" htmlFor="job-location">
              <Input id="job-location" maxLength={100} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Dakar" />
            </Field>
            <Field label="Pays" htmlFor="job-country">
              <Input id="job-country" maxLength={60} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Sénégal" />
            </Field>
          </div>
          <ToggleRow
            icon={<Globe2 aria-hidden />}
            title="Télétravail possible"
            description="L'offre apparaît aussi dans le filtre « Télétravail »."
            checked={form.is_remote}
            onChange={(value) => set('is_remote', value)}
          />
        </FieldGroup>
        <FieldGroup title="Détails">
          <Field label="Technologies" hint="Jusqu'à 12 (react, django, flutter…).">
            <TagInput value={form.stack} max={12} onChange={(stack) => set('stack', stack)} />
          </Field>
          <Field label="Description" htmlFor="job-description" required counter={`${form.description.length}/6000`}>
            <Textarea id="job-description" required maxLength={6000} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Missions, équipe, profil recherché…" />
          </Field>
          <Field label="Lien pour postuler" htmlFor="job-apply" required hint="https://… ou mailto:…">
            <Input id="job-apply" required maxLength={300} value={form.apply_url} onChange={(e) => set('apply_url', e.target.value)} placeholder="https://entreprise.com/jobs/42" />
          </Field>
        </FieldGroup>
        {error ? <FormError>{error}</FormError> : null}
        <div className="-mx-5 -mb-5 flex justify-end gap-2 rounded-b-2xl border-t border-line bg-container-low/60 px-5 py-4">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending}>
            Publier l&apos;offre
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

