/** 75 → « 1:15 » ; 3725 → « 1:02:05 ». */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const SKIP_SECONDS = 10;
