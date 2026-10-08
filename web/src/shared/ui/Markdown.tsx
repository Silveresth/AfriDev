import { Fragment, type ReactNode } from 'react';

import { cn } from '@/shared/lib';

import { CodeBlock } from './CodeBlock';

/**
 * Markdown minimal et sûr (aucun HTML injecté) : titres, listes, blocs de code,
 * code en ligne, gras, italique, liens http(s) et citations [1] des réponses IA.
 */

type Block =
  | { type: 'code'; language: string; code: string }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'paragraph'; text: string };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    const fence = line.match(/^```\s*([\w+#.-]*)/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      blocks.push({ type: 'code', language: fence[1] ?? '', code: code.join('\n') });
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: (heading[1] ?? '').length <= 2 ? 2 : 3, text: heading[2] ?? '' });
      index += 1;
      continue;
    }
    const listItem = /^\s*(?:[-*+]|\d+[.)])\s+/;
    if (listItem.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: string[] = [];
      while (index < lines.length && listItem.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(listItem, ''));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (index < lines.length && (lines[index] ?? '').startsWith('>')) {
        quote.push((lines[index] ?? '').replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !/^(```|#{1,4}\s|>|\s*(?:[-*+]|\d+[.)])\s)/.test(lines[index] ?? '')
    ) {
      paragraph.push(lines[index] ?? '');
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))|(\[\d+\])/g;

function safeHref(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function renderInline(text: string, citeHref?: (n: number) => string | undefined): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const [token] = match;
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const key = `${start}-${token}`;
    if (match[1]) nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (match[2]) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (match[3]) nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    else if (match[4]) {
      const [, label = '', href = ''] = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/) ?? [];
      const safe = safeHref(href);
      nodes.push(
        safe ? (
          <a key={key} href={safe} rel="noopener noreferrer nofollow" target={safe.startsWith('/') ? undefined : '_blank'}>
            {label}
          </a>
        ) : (
          label
        ),
      );
    } else if (match[5]) {
      const n = Number(token.slice(1, -1));
      const href = citeHref?.(n);
      nodes.push(
        href ? (
          <a key={key} href={href} className="font-mono text-label-md no-underline">
            [{n}]
          </a>
        ) : (
          token
        ),
      );
    }
    last = start + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({
  source,
  className,
  citeHref,
}: {
  source: string;
  className?: string;
  /** Lien d'une citation numérotée [n] (sources de la réponse IA). */
  citeHref?: (n: number) => string | undefined;
}) {
  return (
    <div className={cn('prose-afri text-body-md text-ink', className)}>
      {parseBlocks(source).map((block, i) => {
        switch (block.type) {
          case 'code':
            return <CodeBlock key={i} code={block.code} language={block.language || undefined} />;
          case 'heading':
            return block.level === 2 ? (
              <h2 key={i}>{renderInline(block.text, citeHref)}</h2>
            ) : (
              <h3 key={i}>{renderInline(block.text, citeHref)}</h3>
            );
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item, citeHref)}</li>
                ))}
              </List>
            );
          }
          case 'quote':
            return (
              <blockquote key={i} className="border-l-2 border-line-strong pl-3 text-ink-muted">
                {renderInline(block.text, citeHref)}
              </blockquote>
            );
          default:
            return <p key={i}>{renderInline(block.text, citeHref).map((n, j) => <Fragment key={j}>{n}</Fragment>)}</p>;
        }
      })}
    </div>
  );
}
