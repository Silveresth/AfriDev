'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { useSession } from '@/shared/session';

import { OnboardingWizard } from './OnboardingWizard';

/**
 * Ouvre l'assistant d'accueil tant que le profil n'est pas configuré (needs_onboarding),
 * quelle que soit la méthode d'inscription (e-mail, SMS, Google, GitHub) et l'appareil.
 */
export function OnboardingGate() {
  const { profile } = useSession();
  const pathname = usePathname();
  const [closed, setClosed] = useState(false);
  if (!profile?.needs_onboarding || closed || pathname.startsWith('/settings')) return null;
  return <OnboardingWizard name={profile.display_name || profile.username} onDone={() => setClosed(true)} />;
}
