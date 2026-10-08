import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

/** auto : texte seul sur réseau mobile (3G / 4G payante) ; on / off : forcé. */
export type TextOnlyMode = 'auto' | 'on' | 'off';

interface DataSaver {
  mode: TextOnlyMode;
  setMode: (mode: TextOnlyMode) => void;
  /** Vrai si les images ne doivent pas être téléchargées sans un toucher explicite. */
  textOnly: boolean;
  cellular: boolean;
}

const KEY = 'afridev.text-only';
const DataSaverContext = createContext<DataSaver | null>(null);

async function read(): Promise<TextOnlyMode> {
  try {
    const value = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    return value === 'on' || value === 'off' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

function write(value: TextOnlyMode) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, value);
    else void SecureStore.setItemAsync(KEY, value);
  } catch {
    // préférence non retenue
  }
}

/** Mode « texte seul » (même réglage que le web) : économise la data sur les forfaits mobiles. */
export function DataSaverProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<TextOnlyMode>('auto');
  const network = Network.useNetworkState();

  useEffect(() => {
    void read().then(setModeState);
  }, []);

  const setMode = useCallback((value: TextOnlyMode) => {
    setModeState(value);
    write(value);
  }, []);

  const cellular = network.type === Network.NetworkStateType.CELLULAR;
  const textOnly = mode === 'on' || (mode === 'auto' && cellular);
  const value = useMemo(() => ({ mode, setMode, textOnly, cellular }), [cellular, mode, setMode, textOnly]);
  return <DataSaverContext.Provider value={value}>{children}</DataSaverContext.Provider>;
}

export function useDataSaver(): DataSaver {
  const value = useContext(DataSaverContext);
  if (!value) throw new Error('useDataSaver doit être utilisé sous <DataSaverProvider>.');
  return value;
}
