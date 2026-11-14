import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DoorClosed,
  FileText,
  Inbox,
  LayoutDashboard,
  Menu,
  Settings,
  Sparkles,
  UserCog,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { usePermissions } from '@/src/hooks/usePermissions';
import { NotificationsPopover } from '@/src/components/layout/NotificationsPopover';
import { RoleSwitcherMenu } from '@/src/components/layout/RoleSwitcherMenu';
import { cn } from '@/src/utils/cn';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', to: '/', icon: LayoutDashboard },
  { label: 'Properties', to: '/properties', icon: Building2 },
  { label: 'Units', to: '/units', icon: DoorClosed },
  { label: 'Tenants', to: '/tenants', icon: Users },
  { label: 'Leasing & Enquiries', to: '/leasing', icon: Sparkles },
  { label: 'Unified Inbox', to: '/inbox', icon: Inbox },
  { label: 'Maintenance', to: '/maintenance', icon: Wrench },
  { label: 'Payments', to: '/payments', icon: CreditCard },
  { label: 'Lease & Documents', to: '/documents', icon: FileText },
  { label: 'Approvals', to: '/approvals', icon: CheckSquare },
  { label: 'Analytics', to: '/analytics', icon: BarChart3 },
  { label: 'User Management', to: '/users', icon: UserCog, adminOnly: true },
  { label: 'Settings', to: '/settings', icon: Settings },
];

function getBreadcrumbLabel(pathname: string): string {
  if (pathname === '/') return 'Overview';
  const match = NAV_ITEMS.find((n) => n.to !== '/' && pathname.startsWith(n.to));
  return match?.label || 'Workspace';
}

export function DashboardLayout() {
  const { isAdmin } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const currentSection = getBreadcrumbLabel(location.pathname);

  const sidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-[#0B1324] text-slate-200">
      <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-display font-bold text-sm shrink-0">
              PA
            </div>
            <span className="font-display text-base font-bold tracking-tight text-white truncate">
              PropAxis
            </span>
          </div>
        )}
        {collapsed && !isMobile && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-display font-bold text-sm">
            PA
          </div>
        )}
        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => isMobile && setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-blue-600/20 text-white border border-blue-500/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent',
                  collapsed && !isMobile && 'justify-center px-2'
                )
              }
              title={collapsed && !isMobile ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {(!collapsed || isMobile) && (
        <div className="border-t border-slate-800/80 px-4 py-3 text-xs text-slate-400">
          <p className="font-medium text-slate-300">{isAdmin ? 'Company Admin Scope' : 'Assigned Properties Scope'}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {isAdmin ? 'All 4 buildings · Full RBAC' : 'Filtered to assigned buildings'}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:block shrink-0 border-r border-slate-800 transition-all duration-200 sticky top-0 h-screen',
          collapsed ? 'w-[72px]' : 'w-[252px]'
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-[264px] max-w-[85vw]">{sidebarContent(true)}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 whitespace-nowrap">PropAxis</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h1 className="font-display text-base font-semibold text-slate-900 truncate">{currentSection}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <NotificationsPopover />
            <RoleSwitcherMenu />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-7">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
