'use client';

import { cn } from '@/shared/lib';

export interface Serie {
  key: string;
  label: string;
  /** Classe Tailwind de remplissage (fill-…) et de pastille (bg-…). */
  fill: string;
  dot: string;
}

const DAY = new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short' });

/**
 * Histogramme empilé en SVG pur (aucune bibliothèque : quelques centaines d'octets).
 * Un tableau masqué donne les mêmes chiffres aux lecteurs d'écran.
 */
export function StackedBars<T extends { day: string }>({
  data,
  series,
  title,
  height = 160,
}: {
  data: T[];
  series: Serie[];
  title: string;
  height?: number;
}) {
  const value = (point: T, key: string) => Number((point as Record<string, unknown>)[key] ?? 0);
  const totals = data.map((point) => series.reduce((sum, serie) => sum + value(point, serie.key), 0));
  const max = Math.max(1, ...totals);
  const width = 100;
  const gap = data.length > 40 ? 0.15 : 0.3;
  const bar = width / data.length;
  const labelEvery = Math.ceil(data.length / 6);

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((serie) => (
          <span key={serie.key} className="flex items-center gap-1.5 text-label-md text-ink-muted">
            <span className={cn('size-2.5 rounded-sm', serie.dot)} aria-hidden />
            {serie.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full overflow-visible"
        role="img"
        aria-label={`${title} : ${totals.reduce((a, b) => a + b, 0)} au total sur ${data.length} jours, maximum ${max} par jour.`}
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={0}
            x2={width}
            y1={height * ratio}
            y2={height * ratio}
            className="stroke-line"
            strokeWidth={0.3}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {data.map((point, index) => {
          let y = height;
          return (
            <g key={point.day}>
              <title>{`${DAY.format(new Date(point.day))} : ${series.map((s) => `${s.label} ${value(point, s.key)}`).join(', ')}`}</title>
              {series.map((serie) => {
                const h = (value(point, serie.key) / max) * (height - 4);
                y -= h;
                return h > 0 ? (
                  <rect
                    key={serie.key}
                    x={index * bar + (bar * gap) / 2}
                    y={y}
                    width={bar * (1 - gap)}
                    height={h}
                    className={serie.fill}
                  />
                ) : null;
              })}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-label-md text-ink-faint" aria-hidden>
        {data.map((point, index) =>
          index % labelEvery === 0 || index === data.length - 1 ? (
            <span key={point.day}>{DAY.format(new Date(point.day))}</span>
          ) : null,
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Jour</th>
            {series.map((serie) => (
              <th key={serie.key}>{serie.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.day}>
              <td>{point.day}</td>
              {series.map((serie) => (
                <td key={serie.key}>{value(point, serie.key)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Répartition horizontale (statuts, motifs) : une barre par entrée. */
export function Breakdown({
  items,
  empty = 'Aucune donnée sur la période.',
}: {
  items: { label: string; value: number; tone?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'neutral' }[];
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (!items.some((item) => item.value)) return <p className="text-body-sm text-ink-muted">{empty}</p>;
  const tones = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    tertiary: 'bg-tertiary',
    danger: 'bg-danger',
    neutral: 'bg-ink-faint',
  };
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="space-y-1">
          <div className="flex justify-between gap-2 text-body-sm">
            <span className="text-ink">{item.label}</span>
            <span className="text-body-sm text-ink-muted">{item.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-sm bg-container-high">
            <div className={cn('h-full', tones[item.tone ?? 'primary'])} style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
