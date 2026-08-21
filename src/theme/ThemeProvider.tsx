import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { light, dark, ThemeColors } from './tokens';

type Mode = 'light' | 'dark';

interface ThemeContextValue {
  mode: Mode;
  colors: ThemeColors;
  toggle: () => void;
  setMode: (m: Mode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'kpimanagex.theme.mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setModeState(saved);
    });
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  };

  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const value = useMemo(
    () => ({ mode, colors: mode === 'dark' ? dark : light, toggle, setMode }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}
