import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AfriDev Exchange',
    short_name: 'AfriDev',
    description: "L'entraide des développeurs africains, même hors ligne.",
    lang: 'fr',
    start_url: '/feed',
    display: 'standalone',
    background_color: '#fcf9f5',
    theme_color: '#c84b20',
    icons: [
      { src: '/icons/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      // PNG : exigés par Android/iOS pour l'installation et l'icône des notifications push.
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Poser une question', url: '/questions/new' },
      { name: 'Mon coffre de snippets', url: '/snippets' },
    ],
  };
}
