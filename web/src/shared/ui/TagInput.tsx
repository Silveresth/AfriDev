'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

/** Saisie de tags : Entrée ou virgule pour valider, suggestions en un clic. */
export function TagInput({
  value,
  onChange,
  max = 5,
  suggestions = [],
  id,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  suggestions?: string[];
  id?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 30);
    if (tag && !value.includes(tag) && value.length < max) onChange([...value, tag]);
    setDraft('');
  };
  const remaining = suggestions.filter((tag) => !value.includes(tag));

  return (
    <div className="space-y-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line-strong bg-card px-2 py-1.5 shadow-card transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md border border-line bg-container-low py-0.5 pr-1 pl-2 text-body-sm font-medium text-ink">
            <span>#</span>
            {tag}
            <button type="button" aria-label={`Retirer ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))} className="flex size-5 items-center justify-center rounded hover:bg-container-high">
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        {value.length < max ? (
          <input
            id={id}
            value={draft}
            onChange={(event) => {
              const text = event.target.value;
              if (text.endsWith(',')) add(text.slice(0, -1));
              else setDraft(text);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add(draft);
              } else if (event.key === 'Backspace' && !draft && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => draft && add(draft)}
            placeholder="+ Ajouter un tag…"
            className="min-w-32 flex-1 bg-transparent px-1 text-body-md text-ink outline-none placeholder:text-ink-faint"
          />
        ) : null}
      </div>
      {remaining.length && value.length < max ? (
        <div className="flex flex-wrap items-center gap-2 text-body-sm text-ink-muted">
          Suggestions :
          {remaining.map((tag) => (
            <button key={tag} type="button" onClick={() => add(tag)} className="rounded-md border border-line px-2 py-0.5 text-label-md font-medium transition-colors hover:bg-container hover:text-ink">
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
