/** 75 → « 1:15 » ; 3725 → « 1:02:05 ». */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Vitesses proposées, dans l'ordre où un toucher les fait défiler. */
export const SPEEDS = [1, 1.25, 1.5, 2, 0.75] as const;

export function nextSpeed(current: number): number {
  const index = SPEEDS.findIndex((speed) => Math.abs(speed - current) < 0.01);
  return SPEEDS[(index + 1) % SPEEDS.length]!;
}
