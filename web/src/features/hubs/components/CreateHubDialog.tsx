'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { Button, Dialog, Field, Input, Textarea, useToast } from '@/shared/ui';

import { useCreateHub } from '../api';

const ICONS = ['💻', '🐍', '📱', '💸', '☁️', '🤖', '🎨', '🔐', '🌍', '⚡'];

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

export function CreateHubDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateHub();
  const [form, setForm] = useState({ name: '', slug: '', icon: '💻', description: '', target_country: '', rules: '' });
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = slugEdited ? form.slug : slugify(form.name);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const hub = await create.mutateAsync({
        name: form.name,
        slug,
        icon: form.icon,
        description: form.description,
        target_country: form.target_country,
        rules: form.rules.split('\n').map((rule) => rule.trim()).filter(Boolean),
      });
      toast(`h/${hub.slug} est en ligne !`);
      onClose();
      router.push(`/h/${hub.slug}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Créer un hub" className="w-[min(36rem,calc(100vw-2rem))]">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom" htmlFor="hub-name" required counter={`${form.name.length}/60`}>
          <Input
            id="hub-name"
            autoFocus
            maxLength={60}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Python Sénégal"
            required
          />
        </Field>
        <Field label="Adresse" htmlFor="hub-slug" hint="Lettres minuscules, chiffres et tirets.">
          <div className="flex items-center rounded-lg border border-line-strong bg-card shadow-card focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
            <span className="pl-3 text-body-md text-ink-faint">h/</span>
            <input
              id="hub-slug"
              value={slug}
              maxLength={40}
              onChange={(event) => {
                setSlugEdited(true);
                setForm({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') });
              }}
              className="h-10 min-w-0 flex-1 bg-transparent pr-3 pl-0.5 text-body-md text-ink outline-none"
            />
          </div>
        </Field>
        <Field label="Icône">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icône du hub">
            {ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                role="radio"
                aria-checked={form.icon === icon}
                onClick={() => setForm({ ...form, icon })}
                className={`flex size-10 items-center justify-center rounded-lg border text-xl transition-colors ${form.icon === icon ? 'border-primary bg-primary-soft' : 'border-line hover:bg-container-low'}`}
              >
                {icon}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Description" htmlFor="hub-description" counter={`${form.description.length}/500`}>
          <Textarea
            id="hub-description"
            maxLength={500}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="De quoi parle-t-on ici, et pour qui ?"
            className="min-h-20"
          />
        </Field>
        <Field label="Pays visé" htmlFor="hub-country" hint="Laissez vide pour tout le continent.">
          <Input
            id="hub-country"
            value={form.target_country}
            onChange={(event) => setForm({ ...form, target_country: event.target.value })}
            placeholder="Sénégal"
          />
        </Field>
        <Field label="Règles" htmlFor="hub-rules" hint="Une règle par ligne (10 au plus).">
          <Textarea
            id="hub-rules"
            value={form.rules}
            onChange={(event) => setForm({ ...form, rules: event.target.value })}
            placeholder={'Soyez bienveillants\nPas de spam'}
            className="min-h-20"
          />
        </Field>
        {error ? (
          <p role="alert" className="text-body-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending} disabled={form.name.trim().length < 2 || slug.length < 3}>
            Créer le hub
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
