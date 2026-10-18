'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ComponentProps, Fragment, type RefObject, useRef, useState } from 'react';

import { api, unwrap } from '@/shared/api';
import { useDebounced } from '@/shared/hooks';
import { cn } from '@/shared/lib';

import { Avatar } from './Avatar';
import { Textarea } from './Form';

const MENTION_SPLIT = /((?<![\w@/.])@[A-Za-z0-9_]{3,30}\b)/g;
// « @debut » juste avant le curseur (début de texte ou après un espace / ponctuation).
const TRIGGER = /(?:^|[^\w@/.])@([A-Za-z0-9_]{1,30})$/;

/** Texte brut où chaque @pseudo devient un lien vers le profil. */
export function MentionText({ text }: { text: string }) {
  return (
    <>
      {text.split(MENTION_SPLIT).map((part, index) =>
        index % 2 ? (
          <Link key={index} href={`/u/${part.slice(1)}`} className="font-semibold text-primary-ink hover:underline">
            {part}
          </Link>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Autocomplétion des @mentions pour une zone de texte : tapez « @ » puis le début d'un pseudo
 * ou d'un nom, choisissez avec ↑ ↓ et Entrée (ou un clic). Le membre mentionné est notifié à
 * la publication (côté serveur).
 */
export function useMentionAutocomplete(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (value: string) => void,
) {
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query ?? '', 120);
  const people = useQuery({
    queryKey: ['people-search', debounced],
    queryFn: () => unwrap(api.GET('/api/profiles/search/', { params: { query: { q: debounced, limit: 6 } } })),
    enabled: debounced.length >= 1 && query !== null,
    staleTime: 60_000,
    meta: { persist: false },
  });
  const options = query !== null ? (people.data ?? []).filter((person) => !person.is_me) : [];
  const open = query !== null && options.length > 0;

  const detect = () => {
    const element = ref.current;
    if (!element) return;
    const before = element.value.slice(0, element.selectionStart ?? element.value.length);
    const match = before.match(TRIGGER);
    setQuery(match ? (match[1] ?? '') : null);
    setActive(0);
  };

  const pick = (username: string) => {
    const element = ref.current;
    if (!element) return;
    const caret = element.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([A-Za-z0-9_]{0,30})$/, `@${username} `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(before.length, before.length);
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      const person = options[active];
      if (person) pick(person.username);
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setQuery(null);
      return true;
    }
    return false;
  };

  const popup = open ? (
    <ul
      role="listbox"
      aria-label="Membres à mentionner"
      className="animate-pop absolute inset-x-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-card p-1 shadow-raised"
    >
      {options.map((person, index) => (
        <li key={person.id} role="option" aria-selected={index === active}>
          <button
            type="button"
            // mousedown : choisir avant que la zone de texte ne perde le focus.
            onMouseDown={(event) => {
              event.preventDefault();
              pick(person.username);
            }}
            onMouseEnter={() => setActive(index)}
            className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', index === active && 'bg-container')}
          >
            <Avatar name={person.display_name} src={person.avatar_url} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-sm font-semibold text-ink">{person.display_name}</span>
              <span className="block truncate text-label-md text-ink-faint">@{person.username}</span>
            </span>
            {person.is_following ? <span className="text-label-sm text-ink-faint">Suivi</span> : null}
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  return { detect, onKeyDown, popup, close: () => setQuery(null) };
}

/** Zone de texte avec autocomplétion des @mentions (mêmes props qu'un <Textarea>). */
export function MentionTextarea({
  value,
  onValueChange,
  onKeyDown,
  wrapperClassName,
  ...props
}: Omit<ComponentProps<'textarea'>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const mentions = useMentionAutocomplete(ref, value, onValueChange);
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Textarea
        {...props}
        ref={ref}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          mentions.detect();
        }}
        onKeyDown={(event) => {
          if (mentions.onKeyDown(event)) return;
          onKeyDown?.(event);
        }}
        onClick={mentions.detect}
        onBlur={() => window.setTimeout(mentions.close, 150)}
      />
      {mentions.popup}
    </div>
  );
}
