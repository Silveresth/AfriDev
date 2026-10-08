import rulesFile from './rules.json';

export interface SecretRule {
  id: string;
  description: string;
  pattern: string;
  flags?: string;
}

export interface SecretFinding {
  ruleId: string;
  description: string;
  line: number;
  /** Extrait masqué : on n'affiche jamais le secret en clair. */
  preview: string;
}

const compiledRules = (rulesFile.rules as SecretRule[]).map((rule) => ({
  ...rule,
  regex: new RegExp(rule.pattern, `g${rule.flags ?? ''}`),
}));

function mask(value: string): string {
  return value.length <= 8 ? '****' : `${value.slice(0, 4)}…${value.slice(-2)}`;
}

/**
 * Étage 1 du Security Guard : détection locale, sur l'appareil, même hors ligne.
 * L'étage 2 (analyse IA plus fine) tourne côté serveur dans features/snippets.
 */
export function scanForSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  text.split('\n').forEach((content, index) => {
    for (const rule of compiledRules) {
      for (const match of content.matchAll(rule.regex)) {
        findings.push({
          ruleId: rule.id,
          description: rule.description,
          line: index + 1,
          preview: mask(match[0]),
        });
      }
    }
  });
  return findings;
}

export function containsSecret(text: string): boolean {
  return scanForSecrets(text).length > 0;
}
