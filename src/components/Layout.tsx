import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Receipt, Truck, Settings, Banknote, LogOut, Cloud, HardDrive } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { syncLocalToSupabase } from '@/hooks/useData';
import { toast } from 'sonner';
import { useState } from 'react';

const tabs = [
  { to: '/', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/customers', icon: Users, key: 'customers' },
  { to: '/billing', icon: Receipt, key: 'billing' },
  { to: '/collection', icon: Banknote, key: 'collection' },
  { to: '/vendors', icon: Truck, key: 'vendors' },
  { to: '/settings', icon: Settings, key: 'settings' },
];

export default function Layout() {
  const { settings } = useApp();
  const { user, signOut } = useAuth();
  const lang = settings.language;
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const count = await syncLocalToSupabase();
      if (count > 0) {
        toast.success(`Synced ${count} contacts to cloud!`);
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.info('No local data to sync');
      }
    } catch (err: any) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <header className="flex-shrink-0 bg-primary text-primary-foreground px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">{t('appName', lang)}</h1>
          <div className="flex items-center gap-2">
            {user && (
              <>
                <Cloud className="h-3.5 w-3.5" />
                <span className="text-xs opacity-80 hidden sm:inline">{user.email}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={handleSync}
                  disabled={syncing}
                  title="Sync local data to cloud"
                >
                  <HardDrive className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={signOut}
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {!user && (
              <span className="text-xs opacity-80 flex items-center gap-1">
                <HardDrive className="h-3 w-3" /> Offline
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="flex-shrink-0 bg-card border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around">
          {tabs.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${
                  isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span>{t(key, lang)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
