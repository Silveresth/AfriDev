'use client';

import { DEFAULT_HUB_ICON, HUB_ICONS, type HubIconKey, hubIconValue } from '@afridev/validation';
import { Check, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { Button, Dialog, Field, HUB_ICON_COMPONENTS, HubIcon, Input, Textarea, useToast } from '@/shared/ui';

import { useCreateHub } from '../api';

const MAX_RULES = 10;

/** Adresse h/<slug> proposée à partir du nom (« Python Sénégal » → « python-senegal »). */
function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Création d'un hub : aperçu en direct, icône du catalogue, description et règles. */
export function CreateHubDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateHub();
  const [name, setName] = useState('');
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const [icon, setIcon] = useState<HubIconKey>(DEFAULT_HUB_ICON);
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [rule, setRule] = useState('');
  const [error, setError] = useState<string | null>(null);
  const slug = customSlug ?? slugify(name);
  const canSubmit = name.trim().length >= 2 && slug.length >= 3;

  function addRule() {
    const value = rule.trim();
    if (!value || rules.length >= MAX_RULES) return;
    setRules([...rules, value]);
    setRule('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const hub = await create.mutateAsync({
        name: name.trim(),
        slug,
        icon: hubIconValue(icon),
        description: description.trim(),
        target_country: country.trim(),
        rules: rule.trim() ? [...rules, rule.trim()] : rules,
      });
      toast(`h/${hub.slug} est en ligne !`);
      onClose();
      router.push(`/h/${hub.slug}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Créer un hub" className="w-[min(40rem,calc(100vw-2rem))]">
      <form onSubmit={submit} className="space-y-6">
        {/* Aperçu : ce que verront les membres. */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-container-low/60 p-4">
          <HubIcon icon={hubIconValue(icon)} name={name || 'Hub'} size={48} className="rounded-xl" />
          <div className="min-w-0">
            <p className="truncate text-headline-md text-ink">{name.trim() || 'Nom du hub'}</p>
            <p className="truncate text-body-sm text-ink-muted">
              h/{slug || 'adresse'}
              {country.trim() ? ` · ${country.trim()}` : ''}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" htmlFor="hub-name" required counter={`${name.length}/60`}>
            <Input
              id="hub-name"
              autoFocus
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Python Sénégal"
              required
            />
          </Field>
          <Field label="Adresse" htmlFor="hub-slug" hint="Minuscules, chiffres et tirets.">
            <div className="flex items-center rounded-lg border border-line-strong bg-card shadow-card focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
              <span className="pl-3 text-body-md text-ink-faint">h/</span>
              <input
                id="hub-slug"
                value={slug}
                maxLength={40}
                onChange={(event) => setCustomSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="h-10 min-w-0 flex-1 bg-transparent pr-3 pl-0.5 text-body-md text-ink outline-none"
              />
            </div>
          </Field>
        </div>

        <fieldset className="space-y-2.5">
          <legend className="text-body-sm font-medium text-ink">Icône</legend>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10" role="radiogroup" aria-label="Icône du hub">
            {HUB_ICONS.map((item) => {
              const Glyph = HUB_ICON_COMPONENTS[item.lucide];
              const active = icon === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => setIcon(item.key)}
                  className={cn(
                    'relative flex aspect-square items-center justify-center rounded-xl border transition-[border-color,box-shadow]',
                    active ? 'border-transparent ring-2 ring-offset-2 ring-offset-card' : 'border-line hover:border-line-strong',
                  )}
                  style={active ? { backgroundColor: item.color, ['--tw-ring-color' as string]: item.color } : undefined}
                >
                  <Glyph className="size-5" style={{ color: active ? '#fff' : item.color }} aria-hidden />
                  {active ? (
                    <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-card shadow-card">
                      <Check className="size-3" style={{ color: item.color }} aria-hidden />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="text-label-md text-ink-faint">{HUB_ICONS.find((item) => item.key === icon)?.label}</p>
        </fieldset>

        <Field label="Description" htmlFor="hub-description" counter={`${description.length}/500`}>
          <Textarea
            id="hub-description"
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="De quoi parle-t-on ici, et pour qui ?"
            className="min-h-20"
          />
        </Field>

        <Field label="Pays visé" htmlFor="hub-country" hint="Laissez vide pour tout le continent.">
          <Input id="hub-country" value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Sénégal" />
        </Field>

        <div className="space-y-2.5">
          <label htmlFor="hub-rule" className="text-body-sm font-medium text-ink">
            Règles <span className="font-normal text-ink-faint">({rules.length}/{MAX_RULES})</span>
          </label>
          {rules.length ? (
            <ol className="space-y-1.5">
              {rules.map((item, index) => (
                <li key={`${item}-${index}`} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-body-sm text-ink">
                  <span className="text-label-md font-semibold text-ink-faint tabular-nums">{index + 1}.</span>
                  <span className="min-w-0 flex-1">{item}</span>
                  <button
                    type="button"
                    aria-label={`Retirer la règle ${index + 1}`}
                    onClick={() => setRules(rules.filter((_, i) => i !== index))}
                    className="rounded-md p-1 text-ink-faint hover:bg-container hover:text-ink"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          {rules.length < MAX_RULES ? (
            <div className="flex gap-2">
              <Input
                id="hub-rule"
                value={rule}
                maxLength={200}
                onChange={(event) => setRule(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addRule();
                  }
                }}
                placeholder={rules.length ? 'Une autre règle…' : 'Ex. Soyez bienveillants'}
              />
              <Button variant="outline" onClick={addRule} disabled={!rule.trim()}>
                <Plus className="size-4" aria-hidden /> Ajouter
              </Button>
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-body-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!canSubmit}>
            Créer le hub
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
