import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSettings, saveSettings, type AppSettings } from '@/lib/db';

interface AppContextType {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  ready: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>({
    businessName: 'My Shop', ownerName: '', phone: '', address: '',
    gstNumber: '', invoicePrefix: 'INV', defaultGstPercent: 18,
    darkMode: false, language: 'en',
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setReady(true); });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [settings.darkMode]);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...partial };
      saveSettings(updated);
      return updated;
    });
  };

  return (
    <AppContext.Provider value={{ settings, updateSettings, ready }}>
      {children}
    </AppContext.Provider>
  );
}
