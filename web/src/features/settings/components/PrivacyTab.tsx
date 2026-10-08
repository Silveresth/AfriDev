'use client';

import {
  AlertTriangle,
  Code2,
  Copy,
  Download,
  FileJson,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { Button, CopyButton, Field, Input, Select, Skeleton, StatusBadge, Switch, TimeAgo, useToast } from '@/shared/ui';

import { downloadMyData, useAccessTokenActions, useAccessTokens } from '../api';

export function PrivacyTab() {
  return (
    <div className="space-y-6">
      <TokensCard />
      <ExportCard />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Clés d'API & Jetons d'accès personnels
 * ───────────────────────────────────────────────────────────── */
function TokensCard() {
  const tokens = useAccessTokens();
  const { create, revoke } = useAccessTokenActions();
  const toast = useToast();
  const [name, setName] = useState('');
  const [readOnly, setReadOnly] = useState(true);
  const [expires, setExpires] = useState('90');
  const [created, setCreated] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const token = await create.mutateAsync({
        name,
        read_only: readOnly,
        expires_in_days: expires ? Number(expires) : null,
      });
      setCreated(token.token);
      setName('');
      toast('Jeton d’accès créé avec succès.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="border-b border-line bg-container-low/40 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
            <KeyRound className="size-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">Jetons d&apos;accès personnels (API Keys)</h2>
            <p className="text-xs text-ink-muted">Pour vos scripts d&apos;automatisation, CLI et pipelines CI/CD</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Affichage du jeton fraîchement généré */}
        {created && (
          <div className="space-y-2.5 rounded-xl border border-tertiary/30 bg-tertiary-soft/50 p-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-on-tertiary-soft">
              <AlertTriangle className="size-4 shrink-0 text-tertiary" />
              <span>Copiez votre jeton maintenant : il ne sera plus jamais affiché.</span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 font-mono text-xs text-ink">
              <span className="flex-1 font-bold break-all select-all">{created}</span>
              <CopyButton text={created} label="Copier" className="h-7 px-2.5 text-xs" />
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setCreated(null)}>
                J&apos;ai bien sauvegardé ce jeton
              </Button>
            </div>
          </div>
        )}

        {/* Formulaire de création */}
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-container-low/30 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
            <div className="space-y-1">
              <label htmlFor="token-name" className="block text-xs font-bold text-ink">
                Nom du jeton
              </label>
              <input
                id="token-name"
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="ex: Script de backup / GitHub Actions"
                required
                className="h-10 w-full rounded-xl border border-line-strong bg-card px-3 text-xs text-ink placeholder:text-ink-faint transition-all hover:border-ink-faint/60 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="token-expires" className="block text-xs font-bold text-ink">
                Expiration
              </label>
              <select
                id="token-expires"
                value={expires}
                onChange={(event) => setExpires(event.target.value)}
                className="h-10 w-full rounded-xl border border-line-strong bg-card px-3 text-xs font-medium text-ink focus:outline-none"
              >
                <option value="30">30 jours</option>
                <option value="90">90 jours</option>
                <option value="365">1 an</option>
                <option value="">Jamais</option>
              </select>
            </div>

            <Button type="submit" loading={create.isPending} disabled={!name.trim()} className="h-10">
              <Plus className="size-4 mr-1" /> Générer
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card p-3">
            <div>
              <span className="block text-xs font-bold text-ink">Mode Lecture seule</span>
              <span className="block text-[0.7rem] text-ink-muted">
                Recommandé : interdit toute modification ou écriture de données via ce jeton.
              </span>
            </div>
            <Switch checked={readOnly} onChange={setReadOnly} label="Lecture seule" />
          </div>
        </form>

        {/* Liste des jetons actifs */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-ink">Jetons actifs</h3>

          {tokens.isPending ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : tokens.data?.length ? (
            <div className="divide-y divide-line rounded-xl border border-line overflow-hidden">
              {tokens.data.map((token) => (
                <div key={token.id} className="flex flex-wrap items-center justify-between gap-3 bg-card p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">{token.name}</span>
                      <StatusBadge tone={token.read_only ? 'neutral' : 'warning'}>
                        {token.read_only ? 'Lecture seule' : 'Lecture & Écriture'}
                      </StatusBadge>
                    </div>

                    <p className="text-[0.7rem] text-ink-faint mt-0.5">
                      Préfixe : <span className="font-mono">{token.prefix}…</span> · Créé il y a{' '}
                      <TimeAgo date={token.created_at} />
                      {token.last_used_at ? (
                        <> · Utilisé il y a <TimeAgo date={token.last_used_at} /></>
                      ) : (
                        ' · Jamais utilisé'
                      )}
                      {token.expires_at ? ` · Expire le ${new Date(token.expires_at).toLocaleDateString('fr')}` : ''}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-danger hover:bg-danger-soft"
                    onClick={() =>
                      window.confirm(`Révoquer « ${token.name} » ? Les applications utilisant cette clé cesseront de fonctionner.`) &&
                      revoke.mutate(token.id)
                    }
                  >
                    <Trash2 className="size-3.5 mr-1" /> Révoquer
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-container-low/30 p-4 text-center text-xs text-ink-faint">
              Aucun jeton d&apos;accès actif pour le moment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Export de Données (RGPD)
 * ───────────────────────────────────────────────────────────── */
function ExportCard() {
  const { profile } = useSession();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      await downloadMyData(profile?.username ?? 'moi');
      toast('Export de vos données téléchargé.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="border-b border-line bg-container-low/40 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
            <FileJson className="size-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">Exportation & Portabilité des données (RGPD)</h2>
            <p className="text-xs text-ink-muted">Téléchargez une archive complète de votre activité au format JSON lisible</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-ink-muted leading-relaxed">
          Comprend vos discussions, questions, réponses, snippets de code réutilisables, commentaires, collections et paramètres de profil.
          Les secrets sensibles (mots de passe, clés de double authentification) ne sont jamais inclus dans l&apos;export.
        </p>

        <div className="flex items-center justify-between rounded-xl border border-line bg-container-low/40 p-4">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="size-4 text-secondary" />
            <span>Format JSON standardisé et interopérable</span>
          </div>

          <Button variant="outline" size="sm" onClick={download} loading={loading}>
            <Download className="size-3.5 mr-1" /> Télécharger mon archive (JSON)
          </Button>
        </div>
      </div>
    </div>
  );
}
