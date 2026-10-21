/**
 * Branche la source sur l'élément <video> : HLS natif (Safari), sinon hls.js chargé à la
 * demande, sinon le fichier MP4. La qualité HLS est plafonnée à `maxHeight`. Renvoie le nettoyage.
 */
export function attachSource(
  element: HTMLVideoElement,
  { hls, src, maxHeight, autoPlay }: { hls?: string | null; src: string; maxHeight: number; autoPlay: boolean },
): () => void {
  const start = () => {
    if (autoPlay) void element.play().catch(() => {});
  };
  if (!hls || element.canPlayType('application/vnd.apple.mpegurl')) {
    element.src = hls ?? src;
    start();
    return () => {
      element.removeAttribute('src');
      element.load();
    };
  }
  let destroy: (() => void) | undefined;
  let cancelled = false;
  void import('hls.js').then(({ default: Hls }) => {
    if (cancelled) return;
    if (!Hls.isSupported()) {
      element.src = src;
      start();
      return;
    }
    const player = new Hls({ capLevelToPlayerSize: true, startLevel: 0 });
    player.on(Hls.Events.MANIFEST_PARSED, () => {
      // Plafonne la qualité selon le réglage « Qualité vidéo » et le réseau.
      const allowed = player.levels.map((level, index) => ({ index, height: level.height })).filter((l) => l.height <= maxHeight);
      player.autoLevelCapping = allowed.length ? allowed[allowed.length - 1]!.index : 0;
      start();
    });
    player.loadSource(hls);
    player.attachMedia(element);
    destroy = () => player.destroy();
  });
  return () => {
    cancelled = true;
    destroy?.();
  };
}
