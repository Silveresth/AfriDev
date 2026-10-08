'use client';

import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/** « Brouillon enregistré sur l'appareil il y a 4 s ». */
export function DraftStatus({ savedAt }: { savedAt: Date | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, [savedAt]);
  if (!savedAt) return null;
  const seconds = Math.max(1, Math.round((now - savedAt.getTime()) / 1000));
  const ago = seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-secondary-soft px-2 py-1 font-mono text-label-sm text-on-secondary-soft" role="status">
      <CheckCircle2 className="size-3.5" aria-hidden />
      Brouillon enregistré sur l&apos;appareil il y a {ago}
    </span>
  );
}
