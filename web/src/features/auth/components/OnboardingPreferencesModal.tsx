'use client';

import { Check, Compass, Cpu, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { useUpdateProfile } from '@/features/profile';
import { cn } from '@/shared/lib';
import { Button } from '@/shared/ui';

// Grands domaines et spécialités de la tech (format pro, sans emojis ni icônes bizarres)
const DOMAINS = [
  { id: 'web_frontend', label: 'Web & Frontend (React, Vue, Next.js)' },
  { id: 'backend_apis', label: 'Backend & APIs (Python, Go, Node.js, Django)' },
  { id: 'mobile_dev', label: 'Mobile (Flutter, React Native, iOS, Android)' },
  { id: 'cloud_devops', label: 'Cloud, DevOps & Systèmes (Docker, AWS, CI/CD)' },
  { id: 'data_ai', label: 'Data Science, IA & Machine Learning' },
  { id: 'fintech_payments', label: 'FinTech, Passerelles de paiement & Mobile Money' },
  { id: 'cybersecurity', label: 'Cybersécurité & Architecture réseau' },
  { id: 'open_source', label: 'Projets Open Source & Collaboration' },
];

// Technologies & langages les plus représentatifs
const TECH_STACKS = [
  'Python',
  'TypeScript',
  'JavaScript',
  'React',
  'Next.js',
  'Django',
  'FastAPI',
  'Flutter',
  'React Native',
  'Go',
  'Rust',
  'Node.js',
  'Docker',
  'PostgreSQL',
  'Tailwind CSS',
  'Linux',
  'AWS',
  'GraphQL',
];

export function OnboardingPreferencesModal({
  open,
  onComplete,
}: {
  open: boolean;
  onComplete: () => void;
}) {
  const updateProfile = useUpdateProfile();

  const [selectedDomains, setSelectedDomains] = useState<string[]>([
    'web_frontend',
    'backend_apis',
  ]);
  const [selectedStack, setSelectedStack] = useState<string[]>([
    'TypeScript',
    'Python',
    'React',
  ]);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const toggleDomain = (id: string) => {
    setSelectedDomains((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleStack = (tech: string) => {
    setSelectedStack((prev) =>
      prev.includes(tech) ? prev.filter((item) => item !== tech) : [...prev, tech]
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Enregistrement de la stack et des intérêts techniques dans le profil utilisateur
      await updateProfile.mutateAsync({
        stack: selectedStack,
      });
    } catch {
      // Ignorer l'erreur pour ne jamais bloquer l'accès à l'accueil
    } finally {
      setSaving(false);
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-zinc-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-line bg-card p-6 sm:p-8 shadow-2xl space-y-7">
        {/* En-tête sobre et professionnel */}
        <div className="space-y-2 border-b border-line pb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
            <Sparkles className="size-3.5" />
            <span>Configuration de vos centres d’intérêt</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Personnalisez votre fil d&apos;actualités
          </h2>
          <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
            Sélectionnez vos domaines d&apos;expertise et technologies préférées pour que nous vous proposions des discussions, astuces de code et projets adaptés.
          </p>
        </div>

        {/* Section 1 : Domaines d'intérêt (style cartes professionnelles) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-orange-600" />
            <h3 className="text-sm font-bold text-ink">
              Domaines & Spécialités prioritaires
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DOMAINS.map((domain) => {
              const active = selectedDomains.includes(domain.id);
              return (
                <button
                  key={domain.id}
                  type="button"
                  onClick={() => toggleDomain(domain.id)}
                  className={cn(
                    'flex items-center justify-between rounded-xl border p-3.5 text-left text-xs font-semibold transition-all cursor-pointer',
                    active
                      ? 'border-orange-600 bg-orange-50/50 text-orange-950 dark:bg-orange-950/20 dark:text-orange-200 dark:border-orange-500 shadow-xs'
                      : 'border-line bg-container-low/40 text-ink-muted hover:border-line-strong hover:text-ink'
                  )}
                >
                  <span className="leading-snug">{domain.label}</span>
                  <span
                    className={cn(
                      'ml-2 flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold transition-colors',
                      active
                        ? 'border-orange-600 bg-orange-600 text-white'
                        : 'border-line-strong text-transparent'
                    )}
                  >
                    <Check className="size-3 stroke-[3]" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2 : Technologies & Langages */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-orange-600" />
            <div>
              <h3 className="text-sm font-bold text-ink">
                Technologies & Langages clés
              </h3>
              <p className="text-[11px] text-ink-muted">
                Ces mots-clés détermineront les articles et snippets mis en avant dans votre veille.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {TECH_STACKS.map((tech) => {
              const active = selectedStack.includes(tech);
              return (
                <button
                  key={tech}
                  type="button"
                  onClick={() => toggleStack(tech)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none',
                    active
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'border border-line bg-container-low hover:border-line-strong text-ink-muted hover:text-ink'
                  )}
                >
                  {active ? <Check className="size-3 stroke-[3]" /> : null}
                  <span>{tech}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pied d'action */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={onComplete}
            className="text-xs font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            Passer et aller à l&apos;accueil
          </button>

          <Button
            size="lg"
            variant="primary"
            loading={saving}
            onClick={handleFinish}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold"
          >
            <Check className="size-4" />
            Enregistrer mes préférences
          </Button>
        </div>
      </div>
    </div>
  );
}
