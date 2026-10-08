'use client';

import { KeyRound, LaptopMinimal, LogOut, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { Button, CopyButton, Skeleton, StatusBadge, TimeAgo, useToast } from '@/shared/ui';

import { useSessionActions, useSessions, useTwoFactor } from '../api';

export function SecurityTab() {
  return (
    <div className="space-y-6">
      <TwoFactorCard />
      <SessionsCard />
    </div>
  );
}

function CodeInput({ value, onChange, id }: { value: string; onChange: (code: string) => void; id: string }) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      placeholder="123456"
      onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      className="h-10.5 w-36 text-center font-mono text-base font-bold tracking-[0.3em] rounded-xl border border-line-strong bg-card text-ink shadow-xs transition-all hover:border-ink-faint/60 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
      aria-label="Code à 6 chiffres"
    />
  );
}

/* ─────────────────────────────────────────────────────────────
 * Double Authentification (2FA TOTP)
 * ───────────────────────────────────────────────────────────── */
function TwoFactorCard() {
  const { user } = useSession();
  const { setup, enable, disable } = useTwoFactor();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const enabled = Boolean(user?.two_factor_enabled);
  const pending = setup.data && !enabled;

  async function confirm() {
    try {
      if (enabled) {
        await disable.mutateAsync(code);
        toast('Double authentification désactivée.');
        setDisabling(false);
      } else {
        await enable.mutateAsync(code);
        toast('Double authentification activée avec succès.');
        setup.reset();
      }
      setCode('');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-container-low/40 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
            {enabled ? <ShieldCheck className="size-4.5 text-secondary" /> : <KeyRound className="size-4.5" />}
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">Double authentification (2FA)</h2>
            <p className="text-xs text-ink-muted">Protégez votre compte avec un code temporaire TOTP</p>
          </div>
        </div>

        {enabled ? (
          <StatusBadge tone="success">2FA Active</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Non configurée</StatusBadge>
        )}
      </div>

      <div className="p-5 space-y-4">
        {enabled ? (
          disabling ? (
            <div className="space-y-3 rounded-xl border border-danger/30 bg-danger-soft/40 p-4">
              <p className="text-xs font-semibold text-on-danger-soft">
                Entrez un code de votre application d&apos;authentification pour confirmer la désactivation :
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <CodeInput id="totp-disable" value={code} onChange={setCode} />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={confirm}
                  loading={disable.isPending}
                  disabled={code.length !== 6}
                >
                  <ShieldOff className="size-3.5 mr-1" /> Confirmer la désactivation
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDisabling(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-line bg-container-low/40 p-4">
              <div className="text-xs text-ink-muted">
                Votre compte est protégé par TOTP. Vous devrez entrer un code à chaque nouvelle connexion.
              </div>
              <Button variant="outline" size="sm" onClick={() => setDisabling(true)}>
                <ShieldOff className="size-3.5 mr-1" /> Désactiver la 2FA
              </Button>
            </div>
          )
        ) : pending ? (
          <div className="grid gap-6 sm:grid-cols-[auto_1fr] rounded-xl border border-line bg-container-low/30 p-4">
            {/* QR code */}
            <div
              className="size-44 rounded-xl bg-white p-2 ring-1 ring-line shadow-xs flex items-center justify-center [&_svg]:size-full"
              aria-label="QR code à scanner"
              role="img"
              dangerouslySetInnerHTML={{ __html: setup.data.qr_svg }}
            />

            <div className="space-y-3">
              <ol className="list-decimal space-y-1.5 pl-4 text-xs text-ink-muted leading-relaxed">
                <li>Ouvrez Google Authenticator, 2FAS, Aegis ou Microsoft Authenticator.</li>
                <li>Scannez le QR code ci-contre ou copiez la clé manuelle.</li>
                <li>Saisissez le code à 6 chiffres pour valider l&apos;activation.</li>
              </ol>

              {/* Clé manuelle */}
              <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 font-mono text-xs text-ink">
                <span className="flex-1 font-bold tracking-wider">{setup.data.secret.match(/.{1,4}/g)?.join(' ')}</span>
                <CopyButton text={setup.data.secret} label="Copier" className="h-7 px-2.5 text-xs" />
              </div>

              {/* Validation */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <CodeInput id="totp-enable" value={code} onChange={setCode} />
                <Button onClick={confirm} loading={enable.isPending} disabled={code.length !== 6}>
                  Valider et Activer
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-line bg-container-low/40 p-4">
            <p className="text-xs text-ink-muted">
              L&apos;activation de la 2FA ajoute une couche de sécurité vitale contre le vol d&apos;identifiants.
            </p>
            <Button onClick={() => setup.mutate()} loading={setup.isPending} className="shrink-0">
              <ShieldCheck className="size-4 mr-1.5" /> Activer la 2FA
            </Button>
          </div>
        )}

        {setup.isError && <p className="text-xs font-semibold text-danger">{errorMessage(setup.error)}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Sessions & Appareils Connectés
 * ───────────────────────────────────────────────────────────── */
function SessionsCard() {
  const sessions = useSessions();
  const { revoke, revokeOthers } = useSessionActions();
  const toast = useToast();
  const others = sessions.data?.filter((session) => !session.current).length ?? 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-container-low/40 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
            <LaptopMinimal className="size-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">Appareils & Sessions actives</h2>
            <p className="text-xs text-ink-muted">Gérez les sessions ouvertes sur vos différents navigateurs et appareils</p>
          </div>
        </div>

        {others > 0 && (
          <Button
            variant="outline"
            size="sm"
            loading={revokeOthers.isPending}
            onClick={() =>
              revokeOthers.mutate(undefined, {
                onSuccess: (result) =>
                  toast(
                    `${result.revoked} session${result.revoked > 1 ? 's' : ''} déconnectée${result.revoked > 1 ? 's' : ''}.`,
                  ),
              })
            }
          >
            <LogOut className="size-3.5 mr-1" /> Déconnecter les autres ({others})
          </Button>
        )}
      </div>

      <div className="p-5 space-y-3">
        {sessions.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="divide-y divide-line rounded-xl border border-line overflow-hidden">
            {sessions.data?.map((session) => (
              <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 bg-card p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-container text-ink-muted">
                    {session.user_agent?.toLowerCase().includes('mobile') ? (
                      <Smartphone className="size-4.5" />
                    ) : (
                      <LaptopMinimal className="size-4.5" />
                    )}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">
                        {session.user_agent || 'Navigateur inconnu'}
                      </span>
                      {session.current && <StatusBadge tone="success">Cette session</StatusBadge>}
                    </div>
                    <p className="text-[0.7rem] text-ink-faint mt-0.5">
                      IP : <span className="font-mono">{session.ip_address || '—'}</span> · Active il y a{' '}
                      <TimeAgo date={session.last_used_at ?? session.created_at} />
                    </p>
                  </div>
                </div>

                {!session.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-danger hover:bg-danger-soft"
                    onClick={() => revoke.mutate(session.id)}
                  >
                    Déconnecter
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
