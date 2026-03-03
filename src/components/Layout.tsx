import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Receipt, Truck, Settings, Banknote } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';

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
  const lang = settings.language;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <header className="flex-shrink-0 bg-primary text-primary-foreground px-4 py-3 shadow-md">
        <h1 className="text-lg font-bold tracking-tight">{t('appName', lang)}</h1>
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
