'use client';

import { Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { highlight } from 'sugar-high';
import { python } from 'sugar-high/presets';

import { cn, formatBytes, utf8Size } from '@/shared/lib';

const PYTHON_LIKE = new Set(['python', 'py']);

/** HTML coloré par sugar-high (~1 Ko) ; le code est échappé par la bibliothèque. */
export function highlightCode(code: string, language?: string) {
  return highlight(code, PYTHON_LIKE.has((language ?? '').toLowerCase()) ? python : undefined);
}

/** Couleurs de langage façon GitHub (pastille devant le nom du langage). */
const LANGUAGE_COLORS: Record<string, string> = {
  python: '#3572A5',
  py: '#3572A5',
  javascript: '#f1e05a',
  js: '#f1e05a',
  typescript: '#3178c6',
  ts: '#3178c6',
  tsx: '#3178c6',
  jsx: '#f1e05a',
  java: '#b07219',
  kotlin: '#A97BFF',
  swift: '#F05138',
  dart: '#00B4AB',
  go: '#00ADD8',
  rust: '#dea584',
  php: '#4F5D95',
  ruby: '#701516',
  c: '#555555',
  cpp: '#f34b7d',
  csharp: '#178600',
  bash: '#89e051',
  shell: '#89e051',
  sh: '#89e051',
  sql: '#e38c00',
  html: '#e34c26',
  css: '#663399',
  json: '#cbcb41',
  yaml: '#cb171e',
  dockerfile: '#384d54',
};

export function languageColor(language?: string) {
  return LANGUAGE_COLORS[(language ?? '').toLowerCase()] ?? '#8b949e';
}

/** Pastille + nom du langage (« ● python »). */
export function LanguageLabel({ language, className }: { language: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: languageColor(language) }} aria-hidden />
      {language}
    </span>
  );
}

export function CopyButton({ text, className, label = 'Copier' }: { text: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label ? undefined : copied ? 'Copié' : 'Copier le code'}
      title={label ? undefined : 'Copier le code'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // presse-papiers refusé (contexte non sécurisé) : rien à faire
        }
      }}
      className={cn('inline-flex items-center gap-1.5 text-label-md font-medium transition-colors', className)}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {label ? (copied ? 'Copié !' : label) : null}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Code copié' : ''}
      </span>
    </button>
  );
}

/**
 * Bloc de code sombre (dans les deux thèmes), façon GitHub : langage, nom de fichier,
 * copie en un clic, numéros de ligne et lignes signalées (Security Guard).
 * `copyText` : texte copié s'il diffère du code affiché (aperçu tronqué d'un snippet).
 */
export function CodeBlock({
  code,
  copyText,
  language,
  filename,
  lineNumbers = true,
  flaggedLines = [],
  maxHeight,
  footer,
  className,
}: {
  code: string;
  copyText?: string;
  language?: string;
  filename?: string;
  lineNumbers?: boolean;
  flaggedLines?: number[];
  maxHeight?: number;
  footer?: React.ReactNode;
  className?: string;
}) {
  const html = useMemo(() => {
    // Sans le saut de ligne final, pas de ligne vide numérotée en bas du bloc.
    const highlighted = highlightCode(code.replace(/\n+$/, ''), language);
    if (!flaggedLines.length) return highlighted;
    // Marque les lignes signalées : chaque ligne est un <span class="sh__line">.
    let index = 0;
    return highlighted.replace(/<span class="sh__line"/g, (match) => {
      index += 1;
      return flaggedLines.includes(index) ? `${match} data-flagged` : match;
    });
  }, [code, language, flaggedLines]);
  const fullText = copyText ?? code;

  return (
    <figure className={cn('overflow-hidden rounded-lg border border-code-line bg-code-bg text-code-ink', className)}>
      <figcaption className="flex h-10 items-center justify-between gap-3 border-b border-code-line pr-1.5 pl-3.5 text-label-md">
        <span className="flex min-w-0 items-center gap-2.5 font-mono">
          {language ? <LanguageLabel language={language} className="shrink-0 text-code-faint" /> : null}
          {filename ? <span className="truncate text-code-ink">{filename}</span> : null}
          {!language && !filename ? <span className="text-code-faint">code</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-code-faint">
          <span className="hidden font-mono sm:inline">{formatBytes(utf8Size(fullText))}</span>
          <CopyButton
            text={fullText}
            label="Copier le code"
            className="h-7 rounded-md border border-code-line px-2.5 text-code-ink hover:bg-white/5"
          />
        </span>
      </figcaption>
      <pre
        className="code-block overflow-auto px-4 py-3 font-mono text-code"
        data-line-numbers={lineNumbers || undefined}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      {footer ? (
        <div className="border-t border-code-line px-3 py-2 font-mono text-label-sm text-code-faint">{footer}</div>
      ) : null}
    </figure>
  );
}
