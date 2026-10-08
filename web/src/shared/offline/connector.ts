import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/web';

import { API_URL, authFetch, POWERSYNC_URL } from '@/shared/api';

/**
 * Pont entre la base locale et Django :
 * - fetchCredentials : jeton PowerSync émis par features/sync ;
 * - uploadData : envoie la file des écritures faites hors ligne (vidée au retour du réseau).
 */
export class BackendConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const response = await authFetch(new Request(`${API_URL}/api/sync/token/`)).catch(() => null);
    if (!response?.ok) return null;
    const { token } = (await response.json()) as { token: string };
    return { endpoint: POWERSYNC_URL, token };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;
    const response = await authFetch(
      new Request(`${API_URL}/api/sync/upload/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: transaction.crud.map((op) => op.toJSON()) }),
      }),
    );
    // En cas d'échec, l'exception laisse la transaction en file : PowerSync réessaiera.
    if (!response.ok) throw new Error(`upload -> ${response.status}`);
    await transaction.complete();
  }
}
