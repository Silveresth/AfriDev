'use client';

import { BriefcaseBusiness, Check } from 'lucide-react';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import {
  Avatar,
  Button,
  Dialog,
  Field,
  FieldGroup,
  FormError,
  Input,
  PROFILE_COLORS,
  type ProfileColor,
  profileColor,
  TagInput,
  Textarea,
  ToggleRow,
} from '@/shared/ui';

import { type MyProfile, useUpdateProfile, WORK_PREFERENCES, type WorkPreference } from '../api';

/** Modification du profil : identité, liens, stack, disponibilité et couleur du profil. */
export function EditProfileDialog({ profile, open, onClose }: { profile: MyProfile; open: boolean; onClose: () => void }) {
  const update = useUpdateProfile();
  const [form, setForm] = useState({
    display_name: profile.display_name,
    bio: profile.bio,
    location: profile.location,
    website: profile.website,
    github_username: profile.github_username,
    stack: profile.stack,
    open_to_work: profile.open_to_work,
    work_preferences: profile.work_preferences as WorkPreference[],
    daily_rate: profile.daily_rate,
    availability_note: profile.availability_note,
    accent_color: profileColor(profile.username, profile.accent_color),
  });
  const accent = PROFILE_COLORS[form.accent_color].hex;
  const togglePreference = (code: WorkPreference) =>
    setForm((current) => ({
      ...current,
      work_preferences: current.work_preferences.includes(code)
        ? current.work_preferences.filter((value) => value !== code)
        : [...current.work_preferences, code],
    }));

  return (
    <Dialog open={open} onClose={onClose} title="Modifier mon profil" className="w-[min(42rem,calc(100vw-2rem))]">
      <p className="-mt-1 mb-5 text-body-sm text-ink-muted">Ce que la communauté et les recruteurs voient sur votre page publique.</p>
      <form
        className="space-y-7"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await update.mutateAsync(form);
            onClose();
          } catch {
            // erreur affichée ci-dessous
          }
        }}
      >
        <FieldGroup title="Apparence">
          <div className="flex items-center gap-4 rounded-xl border border-line bg-container-low/60 p-3.5">
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: accent }} aria-hidden>
              <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.22)_1px,transparent_1.2px)] bg-[length:8px_8px]" />
              <Avatar
                name={form.display_name || profile.username}
                src={profile.avatar_url}
                color={accent}
                size={30}
                className="absolute bottom-1.5 left-2 ring-2 ring-card"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-body-sm font-semibold text-ink">
                Couleur du profil <span className="font-normal text-ink-muted">· {PROFILE_COLORS[form.accent_color].label}</span>
              </p>
              <div role="radiogroup" aria-label="Couleur du profil" className="flex flex-wrap gap-1.5">
                {(Object.keys(PROFILE_COLORS) as ProfileColor[]).map((key) => {
                  const active = form.accent_color === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={PROFILE_COLORS[key].label}
                      title={PROFILE_COLORS[key].label}
                      onClick={() => setForm({ ...form, accent_color: key })}
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-shadow',
                        active ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-line-strong',
                      )}
                      style={{ backgroundColor: PROFILE_COLORS[key].hex }}
                    >
                      {active ? <Check className="size-3.5 text-white" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </FieldGroup>

        <FieldGroup title="Identité">
          <Field label="Nom affiché" htmlFor="display-name">
            <Input id="display-name" maxLength={80} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </Field>
          <Field label="Bio" htmlFor="bio" counter={`${form.bio.length} / 600`} hint="Votre spécialité, ce sur quoi vous travaillez, ce que vous cherchez.">
            <Textarea id="bio" maxLength={600} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </Field>
          <Field label="Ville, pays" htmlFor="location">
            <Input id="location" maxLength={80} placeholder="Lomé, Togo" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
        </FieldGroup>

        <FieldGroup title="Liens">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pseudo GitHub" htmlFor="github" hint="Affiche vos dépôts et langages.">
              <Input
                id="github"
                maxLength={39}
                placeholder="octocat"
                value={form.github_username}
                onChange={(e) => setForm({ ...form, github_username: e.target.value })}
              />
            </Field>
            <Field label="Site web" htmlFor="website">
              <Input id="website" type="url" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </Field>
          </div>
        </FieldGroup>

        <FieldGroup title="Compétences">
          <Field label="Stack technique" htmlFor="stack" hint="Sert aux recommandations de projets et aux +1 des pairs (20 maximum).">
            <TagInput
              id="stack"
              max={20}
              value={form.stack}
              onChange={(stack) => setForm({ ...form, stack })}
              suggestions={['python', 'django', 'react', 'flutter', 'node', 'go']}
            />
          </Field>
        </FieldGroup>

        <FieldGroup title="Disponibilité">
          <ToggleRow
            icon={<BriefcaseBusiness aria-hidden />}
            title="Ouvert aux opportunités"
            description="Missions freelance, emploi, contributions rémunérées. Un badge s'affiche sur votre profil."
            checked={form.open_to_work}
            onChange={(open_to_work) => setForm({ ...form, open_to_work })}
          />
          {form.open_to_work ? (
            <>
              <Field label="Je recherche">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(WORK_PREFERENCES) as WorkPreference[]).map((code) => {
                    const active = form.work_preferences.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={active}
                        onClick={() => togglePreference(code)}
                        className={cn(
                          'inline-flex h-8 items-center gap-1 rounded-full px-3.5 text-body-sm font-medium transition-colors',
                          active ? 'bg-secondary text-white' : 'bg-card text-ink-muted ring-1 ring-line ring-inset hover:text-ink',
                        )}
                      >
                        {active ? <Check className="size-3.5" aria-hidden /> : null}
                        {WORK_PREFERENCES[code]}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="TJM indicatif" htmlFor="daily-rate" hint="Ex. 150 000 FCFA / jour">
                  <Input id="daily-rate" maxLength={40} value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} />
                </Field>
                <Field label="Disponibilité" htmlFor="availability">
                  <Input
                    id="availability"
                    maxLength={200}
                    placeholder="Disponible dès novembre"
                    value={form.availability_note}
                    onChange={(e) => setForm({ ...form, availability_note: e.target.value })}
                  />
                </Field>
              </div>
            </>
          ) : null}
        </FieldGroup>

        {update.isError ? <FormError>{errorMessage(update.error)}</FormError> : null}
        <div className="-mx-5 -mb-5 flex justify-end gap-2 rounded-b-2xl border-t border-line bg-container-low/60 px-5 py-4">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={update.isPending}>
            Enregistrer le profil
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
