import { cn } from '@/shared/lib';

/** Marque vectorielle (aucune image téléchargée) : chevrons de code sur terracotta. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} aria-hidden>
      <rect width="120" height="120" rx="30" fill="#C84B20" />
      <path d="M48 38L26 60L48 82" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M72 38L94 60L72 82" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="60" cy="60" r="8" fill="#3DDC84" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark size={32} />
      {compact ? null : (
        <span className="text-[1.25rem] leading-none font-extrabold tracking-tight text-ink">
          afridev<span className="text-primary">.</span>
        </span>
      )}
    </span>
  );
}