'use client';

import { MessageCircle } from 'lucide-react';

import { AppIconButton } from '@/shared/layout';

import { useUnreadMessages } from '../api';

/** Bouton « Messages » de l'en-tête du téléphone, avec le nombre de conversations non lues. */
export function MessagesButton() {
  const unread = useUnreadMessages();
  return <AppIconButton icon={MessageCircle} label="Messages" href="/messages" badge={unread.data} />;
}
