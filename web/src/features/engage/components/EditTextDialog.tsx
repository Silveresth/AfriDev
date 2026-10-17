'use client';

import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { Button, Dialog, Field, Input, TagInput, Textarea, useToast } from '@/shared/ui';

export interface TextContent {
  title: string;
  body: string;
  tags: string[];
}

/** Modification d'un post ou d'une question : titre, texte, tags. */
export function EditTextDialog({
  title,
  initial,
  bodyLabel = 'Texte',
  minTitle = 3,
  onSave,
  onClose,
}: {
  title: string;
  initial: TextContent;
  bodyLabel?: string;
  minTitle?: number;
  onSave: (content: TextContent) => Promise<unknown>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...value, title: value.title.trim(), body: value.body.trim() });
      toast('Modifications enregistrées.');
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={title} className="w-[min(40rem,calc(100vw-2rem))]">
      <form onSubmit={submit} className="space-y-4" onClick={(event) => event.stopPropagation()}>
        <Field label="Titre" htmlFor="edit-title" counter={`${value.title.length}/200`}>
          <Input id="edit-title" autoFocus maxLength={200} value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} />
        </Field>
        <Field label={bodyLabel} htmlFor="edit-body">
          <Textarea id="edit-body" maxLength={10000} value={value.body} onChange={(e) => setValue({ ...value, body: e.target.value })} className="min-h-48" />
        </Field>
        <Field label="Tags" htmlFor="edit-tags">
          <TagInput id="edit-tags" value={value.tags} onChange={(tags) => setValue({ ...value, tags })} />
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
          <Button type="submit" loading={saving} disabled={value.title.trim().length < minTitle}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
