'use client';

import { LogOut, PencilLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FeedPreferencesCard } from '@/features/auth';
import { EditProfileDialog } from '@/features/profile';
import { useLang } from '@/shared/i18n';
import { useSession } from '@/shared/session';
import { Avatar, Button, ButtonLink, Card, profileColorHex } from '@/shared/ui';

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
