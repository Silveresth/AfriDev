/**
 * Aperçu du fil « Pour vous » pendant l'accueil : même règle que
 * backend/features/profiles/preferences.py::feed_mix, appliquée aux poids que l'API expose
 * (GET /api/profiles/me/onboarding/). Aucun poids n'est codé en dur côté client ; le serveur
 * reste la référence (MyProfile.feed_mix).
 */
export interface FeedMixCatalogue {
  base_mix: Record<string, number>;
  goals: { id: string; weights: Record<string, number> }[];
  levels: { id: string; weights: Record<string, number> }[];
}

export function computeFeedMix(catalogue: FeedMixCatalogue, goals: string[], level: string): Record<string, number> {
  const weights: Record<string, number> = { ...catalogue.base_mix };
  const bonuses = [
    ...goals.map((id) => catalogue.goals.find((goal) => goal.id === id)?.weights ?? {}),
    catalogue.levels.find((item) => item.id === level)?.weights ?? {},
  ];
  for (const bonus of bonuses) {
    for (const [kind, extra] of Object.entries(bonus)) weights[kind] = (weights[kind] ?? 0) + extra;
  }
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const mix = Object.fromEntries(Object.entries(weights).map(([kind, value]) => [kind, Math.round((value * 100) / total)]));
  const top = Object.keys(mix).reduce((best, kind) => ((mix[kind] ?? 0) > (mix[best] ?? 0) ? kind : best));
  mix[top] = (mix[top] ?? 0) + 100 - Object.values(mix).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(mix).sort((a, b) => b[1] - a[1]));
}
