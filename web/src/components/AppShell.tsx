import { Suspense, useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  BarChart3,
  CalendarCheck2,
  ClipboardList,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { initials } from '@/lib/format';
import { useHotkey, useSettings } from '@/lib/hooks';
import type { Role } from '@/lib/types';
import { ClientPicker } from './ClientPicker';
import { RateWidget } from './RateWidget';
import { Avatar, Modal, Spinner } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
  roles?: Role[];
}

const STAFF: Role[] = ['admin', 'recepcion'];
const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Operación',
    items: [
      { to: '/', label: 'Panel', icon: LayoutDashboard },
      { to: '/asistencias', label: 'Asistencias', icon: CalendarCheck2 },
      { to: '/clientes', label: 'Clientes', icon: Users },
      { to: '/inscripciones', label: 'Inscripciones', icon: UserPlus, roles: STAFF },
      { to: '/renovaciones', label: 'Renovaciones', icon: RefreshCcw, roles: STAFF },
    ],
  },
  {
    section: 'Negocio',
    items: [
      { to: '/planes', label: 'Planes', icon: ClipboardList },
      { to: '/pagos', label: 'Pagos', icon: CreditCard, roles: STAFF },
      { to: '/tienda', label: 'Tienda', icon: ShoppingBag, roles: STAFF },
      { to: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin'] },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { to: '/usuarios', label: 'Usuarios', icon: ShieldCheck, roles: ['admin'] },
      { to: '/configuracion', label: 'Configuración', icon: Settings, roles: ['admin'] },
    ],
  },
];

function useTheme() {
  const [light, setLight] = useState(() => document.documentElement.classList.contains('light'));
  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
    localStorage.setItem('theme', light ? 'light' : 'dark');
  }, [light]);
  return { light, toggle: () => setLight((l) => !l) };
}

export function AppShell() {
  const { user, logout, can } = useAuth();
  const { data: settings } = useSettings();
  const { light, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useHotkey('k', useCallback(() => setSearchOpen(true), []));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid size-10 place-items-center rounded-2xl bg-accent text-accent-fg shadow-[0_8px_24px_-8px_var(--accent)]">
          <Dumbbell className="size-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-none tracking-tight">IronPulse</p>
          <p className="mt-1 truncate text-xs text-muted">{settings?.gym_name ?? 'Gestión de gimnasio'}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.roles || can(...i.roles));
          if (!items.length) return null;
          return (
            <div key={group.section}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/70">{group.section}</p>
              <div className="space-y-0.5">
                {items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      clsx(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                        isActive ? 'bg-surface-3 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={clsx('size-[18px] transition', isActive ? 'text-accent-ink' : 'group-hover:text-fg')} />
                        {label}
                        {isActive && <span className="ml-auto h-5 w-1 rounded-full bg-accent" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar size="sm" name={initials(...((user?.name ?? '').split(' ') as [string, string]))} color="var(--surface-3)" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted">{user && ROLES[user.role]}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-red-400" title="Cerrar sesión">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 animate-fade" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface animate-pop">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:px-6">
          <button className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menú">
            <Menu className="size-5" />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm text-muted transition hover:border-accent/40"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Buscar cliente…</span>
            <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] sm:block">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <RateWidget />
            <button onClick={toggle} className="grid size-10 place-items-center rounded-xl border border-line bg-surface-2 text-muted hover:text-fg" title="Cambiar tema">
              {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
            <Suspense
              fallback={
                <div className="grid h-64 place-items-center">
                  <Spinner className="size-6" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Buscar cliente" subtitle="Escribe cédula, nombre o apellido" size="sm">
        <ClientPicker
          autoFocus
          value={null}
          onChange={(c) => {
            if (c) navigate(`/clientes/${c.id}`);
            setSearchOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
