'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, ExternalLink, Globe, Loader2, RotateCw } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { api, errorMessage, unwrap } from '@/shared/api';

const OpenContext = createContext<(url: string) => void>(() => {});

/** Ouvre une adresse externe dans la visionneuse de la plateforme (sans quitter le site). */
export const useOpenInApp = () => useContext(OpenContext);

const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * Visionneuse interne : le site s'affiche dans un cadre quand il l'autorise ; sinon un aperçu
 * (titre, image, description) avec la possibilité de l'ouvrir à part, en dernier recours.
 */
export function InAppBrowserProvider({ children }: { children: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const open = useCallback((next: string) => setUrl(next), []);
  return (
    <OpenContext.Provider value={open}>
      {children}
      {url ? <Viewer url={url} onClose={() => setUrl(null)} /> : null}
    </OpenContext.Provider>
  );
}

function Viewer({ url, onClose }: { url: string; onClose: () => void }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const preview = useQuery({
    queryKey: ['link-preview', url],
    queryFn: () => unwrap(api.GET('/api/links/preview/', { params: { query: { url } } })),
    staleTime: 60 * 60_000,
    retry: false,
    meta: { persist: false },
  });

  // Échap ferme ; le défilement de la page est bloqué tant que la visionneuse est ouverte.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const data = preview.data;
  const target = data?.final_url || url;
  const frameable = Boolean(data?.frameable);

  return (
    <div role="dialog" aria-modal="true" aria-label={data?.title || domainOf(url)} className="fixed inset-0 z-[60] flex flex-col bg-card">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-2 pt-[env(safe-area-inset-top)] sm:px-3">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Revenir à la plateforme"
          className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-container hover:text-ink"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-body-md font-semibold text-ink">{data?.title || domainOf(target)}</p>
          <p className="flex items-center gap-1 truncate text-label-md text-ink-faint">
            <Globe className="size-3 shrink-0" aria-hidden /> {domainOf(target)}
          </p>
        </div>
        {frameable ? (
          <button
            type="button"
            onClick={() => {
              setLoaded(false);
              setReloadKey((key) => key + 1);
            }}
            aria-label="Recharger"
            title="Recharger"
            className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-container hover:text-ink"
          >
            <RotateCw className="size-4" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(target);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          aria-label="Copier le lien"
          title={copied ? 'Lien copié' : 'Copier le lien'}
          className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-container hover:text-ink"
        >
          <Copy className="size-4" aria-hidden />
        </button>
        <a
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          data-external
          aria-label="Ouvrir dans un nouvel onglet"
          title="Ouvrir dans un nouvel onglet"
          className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-container hover:text-ink"
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </header>

      <div className="relative min-h-0 flex-1 bg-container-low">
        {preview.isPending ? (
          <Centered>
            <Loader2 className="size-6 animate-spin text-ink-muted" aria-hidden />
          </Centered>
        ) : frameable ? (
          <>
            {!loaded ? (
              <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-primary/20">
                <div className="h-full w-1/3 animate-pulse bg-primary" />
              </div>
            ) : null}
            <iframe
              key={reloadKey}
              src={target}
              title={data?.title || domainOf(target)}
              onLoad={() => setLoaded(true)}
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
              className="size-full border-0 bg-white"
            />
          </>
        ) : (
          <Centered>
            <article className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-card shadow-card">
              {data?.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- image d'aperçu du site externe
                <img src={data.image} alt="" className="aspect-[1.91/1] w-full object-cover" referrerPolicy="no-referrer" />
              ) : null}
              <div className="space-y-2 p-5">
                <p className="text-label-md text-ink-faint">{data?.site_name || domainOf(target)}</p>
                <h2 className="text-headline-md text-ink">{data?.title || target}</h2>
                {data?.description ? <p className="text-body-sm text-ink-muted">{data.description}</p> : null}
                {preview.isError ? <p className="text-body-sm text-danger">{errorMessage(preview.error)}</p> : null}
                <p className="pt-2 text-body-sm text-ink-muted">
                  Ce site n’accepte pas d’être affiché à l’intérieur d’une autre page. Vous pouvez l’ouvrir à côté, AfriDev reste ouvert.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={target}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-external
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-body-sm font-semibold text-on-primary hover:opacity-90"
                  >
                    Ouvrir le site <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                  <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg px-3.5 text-body-sm font-semibold text-ink hover:bg-container">
                    Revenir
                  </button>
                </div>
              </div>
            </article>
          </Centered>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex size-full items-center justify-center overflow-y-auto p-4">{children}</div>;
}
