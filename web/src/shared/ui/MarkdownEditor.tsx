'use client';

import { Bold, Code, Italic, Link2, List, Quote, SquareCode } from 'lucide-react';
import { useRef, useState } from 'react';

import { cn } from '@/shared/lib';

import { Segmented } from './Form';
import { Markdown } from './Markdown';

type Action = { label: string; icon: typeof Bold; before: string; after?: string; block?: boolean };

const ACTIONS: Action[] = [
  { label: 'Gras', icon: Bold, before: '**', after: '**' },
  { label: 'Italique', icon: Italic, before: '*', after: '*' },
  { label: 'Lien', icon: Link2, before: '[', after: '](https://)' },
  { label: 'Citation', icon: Quote, before: '> ', block: true },
  { label: 'Code en ligne', icon: Code, before: '`', after: '`' },
  { label: 'Liste', icon: List, before: '- ', block: true },
  { label: 'Bloc de code', icon: SquareCode, before: '\n```python\n', after: '\n```\n' },
];

/** Zone de texte Markdown : onglets Écrire / Aperçu et barre d'outils. */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeight = 220,
  id,
  label,
  maxLength,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  id?: string;
  label?: string;
  maxLength?: number;
  invalid?: boolean;
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(action: Action) {
    const element = ref.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const prefix = action.block && start > 0 && value[start - 1] !== '\n' ? `\n${action.before}` : action.before;
    const next = value.slice(0, start) + prefix + selected + (action.after ?? '') + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      element?.focus();
      const cursor = start + prefix.length + selected.length;
      element?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card shadow-card transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15', invalid ? 'border-danger' : 'border-line-strong')}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-container-low px-2 py-1">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'write', label: 'Écrire' },
            { value: 'preview', label: 'Aperçu' },
          ]}
          className="bg-transparent p-0"
        />
        {tab === 'write' ? (
          <div className="flex flex-wrap" role="toolbar" aria-label="Mise en forme">
            {ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                title={action.label}
                aria-label={action.label}
                onClick={() => apply(action)}
                className="flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-container hover:text-ink"
              >
                <action.icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {tab === 'write' ? (
        <textarea
          ref={ref}
          id={id}
          aria-label={label}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="block w-full resize-y bg-card px-3 py-2.5 text-body-md leading-6 text-ink outline-none placeholder:text-ink-faint"
          style={{ minHeight }}
        />
      ) : (
        <div className="px-3 py-2.5" style={{ minHeight }}>
          {value.trim() ? <Markdown source={value} /> : <p className="text-body-sm text-ink-faint">Rien à prévisualiser.</p>}
        </div>
      )}
    </div>
  );
}
