'use client';

import { scanForSecrets, type SecretFinding } from '@afridev/validation';
import rulesFile from '@afridev/validation/security-guard/rules.json';
import { ShieldAlert, Wand2 } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/shared/ui';

export type { SecretFinding };

/**
 * Étage 1 du Security Guard, exécuté sur l'appareil (même hors ligne) avec les mêmes règles
 * que le backend. Le bouton « Publier » reste verrouillé tant qu'un secret est présent.
 */
export function useSecretScan(...texts: string[]): SecretFinding[] {
  const joined = texts.join('\n\u0000\n');
  return useMemo(
    () => joined.split('\n\u0000\n').flatMap((text) => scanForSecrets(text)),
    [joined],
  );
}

const PLACEHOLDER = 'SECRET_RETIRE';

/** Remplace les secrets détectés par un marqueur, en gardant le nom de la variable. */
export function redactSecrets(text: string): string {
  let result = text;
  for (const rule of rulesFile.rules as Array<{ pattern: string; flags?: string }>) {
    const regex = new RegExp(rule.pattern, `g${rule.flags ?? ''}`);
    result = result.replace(regex, (match) =>
      /(['"]).+\1/.test(match) ? match.replace(/(['"])[^'"]*\1/, `$1${PLACEHOLDER}$1`) : PLACEHOLDER,
    );
  }
  return result;
}

export function SecretAlert({
  findings,
  onRedact,
}: {
  findings: SecretFinding[];
  onRedact?: () => void;
}) {
  if (!findings.length) return null;
  const [first] = findings;
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger-soft p-4 text-on-danger-soft sm:flex-row sm:items-start"
    >
      <ShieldAlert className="size-6 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">
          Alerte Security Guard : secret détecté ligne {first?.line}
        </p>
        <ul className="space-y-0.5 text-body-sm">
          {findings.map((finding, index) => (
            <li key={index}>
              {finding.description} (ligne {finding.line}, <code className="font-mono">{finding.preview}</code>)
            </li>
          ))}
        </ul>
        <p className="text-body-sm">
          Retirez-le ou utilisez une variable d&apos;environnement pour protéger votre compte. La
          publication est verrouillée.
        </p>
      </div>
      {onRedact ? (
        <Button variant="danger" size="sm" onClick={onRedact} className="self-start">
          <Wand2 className="size-4" aria-hidden /> Nettoyer automatiquement
        </Button>
      ) : null}
    </div>
  );
}
