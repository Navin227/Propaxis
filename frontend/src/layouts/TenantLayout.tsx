import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Bell,
  Building,
  CreditCard,
  FileText,
  Home,
  Menu,
  MessageSquare,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { NotificationsPopover } from '@/src/components/layout/NotificationsPopover';
import { RoleSwitcherMenu } from '@/src/components/layout/RoleSwitcherMenu';
import { cn } from '@/src/utils/cn';

const TENANT_NAV = [
  { label: 'Home', to: '/tenant/home', icon: Home },
  { label: 'My Property', to: '/tenant/property', icon: Building },
  { label: 'Payments', to: '/tenant/payments', icon: CreditCard },
  { label: 'Maintenance', to: '/tenant/maintenance', icon: Wrench },
  { label: 'Documents', to: '/tenant/documents', icon: FileText },
  { label: 'AI Assistant', to: '/tenant/assistant', icon: MessageSquare },
  { label: 'Notifications', to: '/tenant/notifications', icon: Bell },
  { label: 'Profile', to: '/tenant/profile', icon: User },
];

const MOBILE_PRIMARY_TABS = [
  { label: 'Home', to: '/tenant/home', icon: Home },
  { label: 'Payments', to: '/tenant/payments', icon: CreditCard },
  { label: 'Repair', to: '/tenant/maintenance', icon: Wrench },
  { label: 'AI Help', to: '/tenant/assistant', icon: MessageSquare },
];

export function TenantLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 pb-20 lg:pb-0">
      {/* Compact Sticky Top App Bar (<= 56px) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden cursor-pointer"
            aria-label="Open tenant menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            PropAxis
          </span>
        </div>

        <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600">
          {TENANT_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap shrink-0 py-1 transition-colors',
                  isActive
                    ? 'text-blue-700 font-semibold border-b-2 border-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <NotificationsPopover />
          <RoleSwitcherMenu />
        </div>
      </header>

      {/* Mobile Slide-Over Menu for Full 8-Section Tenant Navigation */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/45" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
              <span className="font-display text-base font-bold text-slate-900">Resident Portal</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {TENANT_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 text-sm font-medium',
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Responsive Viewport */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 lg:py-7">
        <Outlet />
      </main>

      {/* Mobile Bottom Tab Bar (<= 60px height, >=44px hitboxes) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid h-15 grid-cols-4 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
        {MOBILE_PRIMARY_TABS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
