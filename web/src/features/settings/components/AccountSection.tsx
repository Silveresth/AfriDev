'use client';

import { LogOut, MailWarning, PencilLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FeedPreferencesCard } from '@/features/auth';
import { EditProfileDialog } from '@/features/profile';
import { api, errorMessage, unwrap } from '@/shared/api';
import { useLang } from '@/shared/i18n';
import { useSession } from '@/shared/session';
import { Avatar, Button, ButtonLink, Card, profileColorHex, useToast } from '@/shared/ui';

/** Adresse non confirmée : rappel et renvoi du lien (valable 3 jours). */
function VerifyEmailCard({ email }: { email: string }) {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const resend = async () => {
    setSending(true);
    try {
      await unwrap(api.POST('/api/accounts/email/resend/'));
      toast(`Lien envoyé à ${email}. Pensez à regarder dans les indésirables.`);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setSending(false);
    }
  };
  return (
    <Card className="flex flex-col gap-3 border-tertiary/30 bg-tertiary-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <MailWarning className="mt-0.5 size-5 shrink-0 text-tertiary" aria-hidden />
        <div>
          <p className="text-body-sm font-semibold text-ink">Adresse e-mail à confirmer</p>
          <p className="text-body-sm text-ink-muted">
            Ouvrez le lien reçu à {email} : il prouve que l&apos;adresse est la vôtre et protège votre compte.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" loading={sending} onClick={() => void resend()}>
        Renvoyer le lien
      </Button>
    </Card>
  );
}

/** Compte : identité, composition du fil « Pour vous » et déconnexion. */
export function AccountSection() {
  const { user, profile, signOut } = useSession();
  const { t } = useLang();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  if (!user) return null;
  const name = profile?.display_name || user.username;

  return (
    <>
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <Avatar name={name} src={profile?.avatar_url} size={56} color={profileColorHex(user.username, profile?.accent_color)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-headline-md text-ink">{name}</p>
          <p className="truncate text-body-sm text-ink-muted">
            @{user.username}
            {user.email ? ` · ${user.email}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/profile" variant="outline" size="sm">
            {t('settings.account.view')}
          </ButtonLink>
          {profile ? (
            <Button variant="subtle" size="sm" onClick={() => setEditing(true)}>
              <PencilLine className="size-4" aria-hidden /> {t('settings.account.edit')}
            </Button>
          ) : null}
        </div>
      </Card>
      {profile ? <EditProfileDialog profile={profile} open={editing} onClose={() => setEditing(false)} /> : null}

      {user.email && !user.email_verified ? <VerifyEmailCard email={user.email} /> : null}

      <FeedPreferencesCard />

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-body-sm font-semibold text-ink">{t('settings.account.logout')}</p>
          <p className="text-body-sm text-ink-muted">{t('settings.account.logout_desc')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-danger hover:border-danger/40 hover:bg-danger-soft"
          onClick={() => {
            signOut();
            router.replace('/');
          }}
        >
          <LogOut className="size-4" aria-hidden /> {t('settings.account.logout')}
        </Button>
      </Card>
    </>
  );
}
