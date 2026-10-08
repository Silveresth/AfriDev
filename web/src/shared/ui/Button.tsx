import Link from 'next/link';
import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib';

/**
 * Bouton façon shadcn/ui (coins de 10 px, hauteur fixe, focus visible) :
 * - primary : action principale (terre cuite) ;
 * - secondary : action positive (vert) ;
 * - outline (alias ghost) : action secondaire, contour fin ;
 * - plain : action discrète sans contour (barres d'actions) ;
 * - subtle : fond gris doux ;
 * - danger, link.
 */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'plain' | 'subtle' | 'danger' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary shadow-card hover:bg-primary-hover',
  secondary: 'bg-secondary text-white shadow-card hover:bg-secondary-hover',
  outline: 'border border-line bg-card text-ink shadow-card hover:bg-container-low hover:border-line-strong',
  ghost: 'border border-line bg-card text-ink shadow-card hover:bg-container-low hover:border-line-strong',
  plain: 'bg-transparent text-ink-muted hover:bg-container hover:text-ink',
  subtle: 'bg-container text-ink hover:bg-container-high',
  danger: 'bg-danger text-white shadow-card hover:opacity-90',
  link: 'px-0 text-primary-ink underline-offset-4 hover:underline',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-body-sm',
  md: 'h-9 gap-2 px-4 text-body-sm',
  lg: 'h-11 gap-2 px-5 text-body-md',
  icon: 'size-9',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] select-none',
    'focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    variant !== 'link' && SIZES[size],
    className,
  );
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}

/** Bouton à icône seule (en-tête, menus) : libellé obligatoire pour les lecteurs d'écran. */
export function IconButton({
  label,
  className,
  children,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-container hover:text-ink disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  );
}

/** Action discrète des barres de posts (voter, commenter, partager, traduire). */
export const pillAction =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-body-sm font-medium text-ink-muted transition-colors hover:bg-container hover:text-ink disabled:pointer-events-none';
