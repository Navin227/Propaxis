import { ChevronDown, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { UserRole } from '@/src/types';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Company Admin',
  manager: 'Property Manager',
  tenant: 'Tenant Portal',
};

export function RoleSwitcherMenu() {
  const { user, availablePersonas, loginAsPersona, logout } = useAuth();
  const navigate = useNavigate();

  const handlePersonaSelect = (personaId: string, role: UserRole) => {
    loginAsPersona(personaId);
    if (role === 'tenant') {
      navigate('/tenant/home');
    } else {
      navigate('/');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="h-7 w-7 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shrink-0">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
          )}
          <div className="hidden sm:block max-w-[140px]">
            <p className="truncate text-xs font-semibold text-slate-900 leading-tight">{user.name}</p>
            <p className="truncate text-[11px] text-slate-500 leading-tight">{ROLE_LABELS[user.role]}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Switch Active Role (Dev / Demo)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availablePersonas.map((persona) => {
          const active = persona.id === user.id;
          return (
            <DropdownMenuItem
              key={persona.id}
              onClick={() => handlePersonaSelect(persona.id, persona.role)}
              className={active ? 'bg-blue-50/70 text-blue-900' : ''}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{persona.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {ROLE_LABELS[persona.role]} · {persona.assignedPropertyIds.length} prop
                  </p>
                </div>
                {active ? (
                  <UserCheck className="h-4 w-4 text-blue-700 shrink-0" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-slate-300 shrink-0" />
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="text-red-600 focus:text-red-700"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out to Login</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
