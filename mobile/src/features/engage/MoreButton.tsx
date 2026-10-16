import { MoreHorizontal } from 'lucide-react-native';
import { useState } from 'react';

import { useT } from '@/shared/i18n';
import { IconButton } from '@/shared/ui';

import { type MoreActions, MoreSheet } from './MoreSheet';

/** Bouton « … » d'en-tête : signaler, modifier, supprimer selon les droits du visiteur. */
export function MoreButton(actions: MoreActions) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!actions.report && !actions.onEdit && !actions.onDelete) return null;
  return (
    <>
      <IconButton icon={MoreHorizontal} label={t('act.more')} onPress={() => setOpen(true)} />
      <MoreSheet {...actions} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
