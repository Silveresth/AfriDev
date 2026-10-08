'use client';

import { useRef } from 'react';

import { cn } from '@/shared/lib';

/**
 * Zone de saisie de code : police monospace, numéros de ligne, tabulation = 2 espaces,
 * lignes signalées en rouge (Security Guard). Volontairement sans dépendance lourde.
 */
export function CodeEditor({
  value,
  onChange,
  flaggedLines = [],
  placeholder,
  minRows = 12,
  id,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  flaggedLines?: number[];
  placeholder?: string;
  minRows?: number;
  id?: string;
  label?: string;
}) {
  const gutter = useRef<HTMLDivElement>(null);
  const lineCount = Math.max(value.split('\n').length, minRows);

  return (
    <div className="flex overflow-hidden rounded-xl bg-code-bg font-mono text-code text-code-ink focus-within:ring-3 focus-within:ring-primary/40">
      <div
        ref={gutter}
        aria-hidden
        className="select-none overflow-hidden border-r border-code-line py-2.5 text-right text-code-faint"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i}
            className={cn('px-2 leading-[1.375rem]', flaggedLines.includes(i + 1) && 'bg-danger text-white')}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        id={id}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        rows={minRows}
        onScroll={(event) => {
          if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || event.shiftKey) return;
          event.preventDefault();
          const target = event.currentTarget;
          const { selectionStart, selectionEnd } = target;
          const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
          onChange(next);
          requestAnimationFrame(() => target.setSelectionRange(selectionStart + 2, selectionStart + 2));
        }}
        className="min-h-60 w-full resize-y whitespace-pre bg-transparent px-3 py-2.5 leading-[1.375rem] text-code-ink outline-none placeholder:text-code-faint"
      />
    </div>
  );
}
