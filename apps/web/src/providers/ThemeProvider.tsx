'use client';

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

interface ThemeProviderProps {
  children: ReactNode;
}

// Inner component to sync store → next-themes
function ThemeSync() {
  const { setTheme: setNextTheme } = useTheme();
  const storeTheme = useSettingsStore((s) => s.theme);
  const lastSetTheme = useRef<string | null>(null);

  // Sync store → next-themes whenever store changes
  useEffect(() => {
    // Only set if this is a new value from the store
    if (storeTheme && storeTheme !== lastSetTheme.current) {
      lastSetTheme.current = storeTheme;
      setNextTheme(storeTheme);
    }
  }, [storeTheme, setNextTheme]);

  return null;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeSync />
      {children}
    </NextThemesProvider>
  );
}
