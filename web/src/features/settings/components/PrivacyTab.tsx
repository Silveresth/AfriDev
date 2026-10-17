'use client';

import {
  AlertTriangle,
  Download,
  FileJson,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  UserX,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { Button, Card, CardHeader, CopyButton, Dialog, Skeleton, StatusBadge, Switch, TimeAgo, useToast } from '@/shared/ui';

import { downloadMyData, useAccessTokenActions, useAccessTokens, useDeleteAccount } from '../api';

export function PrivacyTab() {
  return (
    <div className="space-y-6">
      <TokensCard />
      <ExportCard />
      <DeleteAccountCard />
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
    <Card className="space-y-5 p-5">
      <CardHeader
        icon={<KeyRound className="size-4" />}
        title="Jetons d'accès personnels"
        subtitle="Pour vos scripts, la CLI et vos pipelines CI/CD"
      />

      <div className="space-y-5">
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
    </Card>
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
    <Card className="space-y-4 p-5">
      <CardHeader
        icon={<FileJson className="size-4" />}
        title="Exporter mes données"
        subtitle="Archive JSON complète de votre activité (droit à la portabilité)"
        action={
          <Button variant="outline" size="sm" onClick={download} loading={loading}>
            <Download className="size-4" aria-hidden /> Télécharger
          </Button>
        }
      />
      <p className="flex items-start gap-2.5 rounded-xl bg-container-low px-4 py-3 text-body-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
        Posts, questions, réponses, snippets, commentaires, collections et profil. Les secrets (mot de passe,
        clés de double authentification) ne sont jamais inclus.
      </p>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Suppression du compte (RGPD, droit à l'effacement)
 * ───────────────────────────────────────────────────────────── */
function DeleteAccountCard() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const remove = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const hasPassword = user?.has_password ?? true;

  function close() {
    setOpen(false);
    setSecret('');
    remove.reset();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    remove.mutate(hasPassword ? { password: secret, confirm: '' } : { password: '', confirm: secret }, {
      onSuccess: () => {
        signOut();
        router.replace('/');
      },
    });
  }

  return (
    <Card className="space-y-4 border-danger/40 p-5">
      <CardHeader
        icon={<UserX className="size-4 text-danger" />}
        title="Supprimer mon compte"
        subtitle="Définitif : profil, publications, messages et médias sont effacés"
        action={
          <Button variant="outline" size="sm" className="border-danger/50 text-danger hover:bg-danger-soft" onClick={() => setOpen(true)}>
            <Trash2 className="size-4" aria-hidden /> Supprimer
          </Button>
        }
      />
      <Dialog open={open} onClose={close} title="Supprimer votre compte ?">
        <form onSubmit={submit} className="space-y-4">
          <p className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3 text-body-sm text-on-danger-soft">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Cette action est irréversible. Pensez à exporter vos données avant de continuer.
          </p>
          <div className="space-y-1">
            <label htmlFor="delete-secret" className="block text-xs font-bold text-ink">
              {hasPassword ? 'Votre mot de passe' : `Tapez « ${user?.username ?? ''} » pour confirmer`}
            </label>
            <input
              id="delete-secret"
              type={hasPassword ? 'password' : 'text'}
              autoComplete={hasPassword ? 'current-password' : 'off'}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              required
              className="h-10 w-full rounded-xl border border-line-strong bg-card px-3 text-body-sm text-ink focus:border-danger focus:ring-4 focus:ring-danger/12 focus:outline-none"
            />
          </div>
          {remove.isError ? <p className="text-body-sm text-danger">{errorMessage(remove.error)}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={close}>
              Annuler
            </Button>
            <Button type="submit" loading={remove.isPending} disabled={!secret.trim()} className="bg-danger text-white hover:bg-danger/90">
              Supprimer définitivement
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
