import type { Metadata } from 'next';

import { AdminShell } from '@/features/backoffice';

export const metadata: Metadata = {
  title: { default: 'Back-office', template: '%s · Back-office AfriDev' },
  robots: { index: false, follow: false },
};

/** Back-office : cadre séparé du site, réservé à l'équipe (vérifié aussi par l'API). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}