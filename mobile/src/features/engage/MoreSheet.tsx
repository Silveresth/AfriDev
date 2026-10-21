import { router } from 'expo-router';
import { Flag, Pencil, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { type Key, useT } from '@/shared/i18n';
import { haptic } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { Row, Sheet, useToast } from '@/shared/ui';

import { REPORT_REASONS, type ReportType, useReport } from './api';

export interface MoreActions {
  /** Absent : pas de signalement (son propre contenu). */
  report?: { type: ReportType; id: string };
  onEdit?: () => void;
  editLabel?: string;
  onDelete?: () => void;
}

/**
 * Menu « … » d'un contenu : signaler (motif en un geste), modifier, supprimer (après confirmation).
 * `reportOnly` : la feuille s'ouvre directement sur les motifs (bouton drapeau d'un commentaire).
 */
export function MoreSheet({
  visible,
  onClose,
  report,
  onEdit,
  editLabel,
  onDelete,
  reportOnly = false,
}: MoreActions & { visible: boolean; onClose: () => void; reportOnly?: boolean }) {
  const { t } = useT();
  const toast = useToast();
  const { isAuthenticated } = useSession();
  const send = useReport();
  const first = reportOnly ? 'report' : 'menu';
  const [step, setStep] = useState<'menu' | 'report'>(first);
  // Action qui ouvre un écran : lancée une fois la feuille refermée (sinon l'écran reste dessous).
  const after = useRef<(() => void) | null>(null);

  const close = (then?: () => void) => {
    after.current = then ?? null;
    onClose();
    setStep(first);
  };
  const runAfter = () => {
    const action = after.current;
    after.current = null;
    action?.();
  };

  const confirmDelete = () =>
    close(() =>
      Alert.alert(t('act.delete_title'), t('feed.delete_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: onDelete },
      ]),
    );

  const pickReason = (reason: (typeof REPORT_REASONS)[number]) => {
    if (!report) return;
    send.mutate(
      { ...report, reason },
      {
        onSuccess: () => {
          haptic.success();
          toast(t('act.reported'));
        },
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    );
    close();
  };

  return (
    <Sheet visible={visible} onClose={() => close()} onHidden={runAfter} title={step === 'report' ? t('act.report_title') : undefined}>
      <View style={styles.list}>
        {step === 'report'
          ? REPORT_REASONS.map((reason, index) => (
              <Row key={reason} label={t(`act.reason.${reason}` as Key)} onPress={() => pickReason(reason)} last={index === REPORT_REASONS.length - 1} />
            ))
          : [
              onEdit ? (
                <Row
                  key="edit"
                  icon={Pencil}
                  label={editLabel ?? t('common.edit')}
                  onPress={() => close(onEdit)}
                />
              ) : null,
              onDelete ? <Row key="delete" icon={Trash2} label={t('common.delete')} danger onPress={confirmDelete} /> : null,
              report ? (
                <Row
                  key="report"
                  icon={Flag}
                  label={t('feed.report')}
                  onPress={() => {
                    if (isAuthenticated) return setStep('report');
                    close(() => router.push('/login'));
                  }}
                  last
                />
              ) : null,
            ]}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 4 },
});
