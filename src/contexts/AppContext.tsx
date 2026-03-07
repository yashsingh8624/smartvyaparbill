import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSettings, saveSettings, type AppSettings } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseSettings, saveSupabaseSettings } from '@/hooks/useData';

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

const DEFAULT_SETTINGS: AppSettings = {
  businessName: 'My Shop', ownerName: '', phone: '', address: '',
  gstNumber: '', invoicePrefix: 'INV', defaultGstPercent: 18,
  darkMode: false, language: 'en',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      if (user) {
        const s = await getSupabaseSettings();
        if (s) {
          setSettings(s);
        } else {
          // First login - try loading from Dexie then save to Supabase
          const local = await getSettings();
          await saveSupabaseSettings(local);
          const fresh = await getSupabaseSettings();
          setSettings(fresh || local);
        }
      } else {
        const s = await getSettings();
        setSettings(s);
      }
      setReady(true);
    }
    load();
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [settings.darkMode]);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...partial };
      if (user) {
        saveSupabaseSettings(updated);
      } else {
        saveSettings(updated);
      }
      return updated;
    });
  };

  return (
    <AppContext.Provider value={{ settings, updateSettings, ready }}>
      {children}
    </AppContext.Provider>
  );
}
