/**
 * Règles du compte, identiques côté site, appli et serveur
 * (backend : features/accounts/services.USERNAME_PATTERN et password_rules.CompositionValidator).
 */

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;
export const USERNAME_HINT = '3 à 30 caractères : lettres, chiffres ou _';

export interface PasswordRule {
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { label: '8 caractères', test: (p) => p.length >= 8 },
  { label: 'un chiffre', test: (p) => /\d/.test(p) },
  { label: 'une majuscule ou un symbole', test: (p) => /[A-Z]|[^A-Za-z0-9]/.test(p) },
];

/** Le serveur refuse en plus les mots de passe trop courants (« Password1 », « azerty123 »…). */
export const PASSWORD_HINT = '8 caractères, un chiffre et une majuscule ou un symbole';

export const passwordRulesPassed = (password: string) => PASSWORD_RULES.filter((rule) => rule.test(password)).length;
export const isPasswordValid = (password: string) => passwordRulesPassed(password) === PASSWORD_RULES.length;
