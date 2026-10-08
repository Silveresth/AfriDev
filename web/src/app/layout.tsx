import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { AppProviders } from '@/shared/providers/AppProviders';

import '@/styles/globals.css';

// Polices auto-hébergées et sous-ensemble latin : aucune requête vers Google côté visiteur.
// Geist (Vercel) : police variable, un seul fichier couvre toutes les graisses.
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: { default: 'AfriDev Exchange', template: '%s · AfriDev Exchange' },
  description:
    "Le réseau d'entraide des développeurs africains : apprendre, s'entraider et contribuer, même avec une petite connexion.",
  applicationName: 'AfriDev Exchange',
  icons: { icon: '/icons/logo.svg' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111113' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
