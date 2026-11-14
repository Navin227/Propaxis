import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setApiSessionHeaders } from '@/src/services/api/client';
import { SEED_USERS } from '@/src/services/mock/seedData';
import { UserAccount, UserRole } from '@/src/types';

interface AuthContextValue {
  user: UserAccount;
  isAuthenticated: boolean;
  availablePersonas: UserAccount[];
  switchRole: (role: UserRole) => void;
  loginAsPersona: (userId: string) => void;
  logout: () => void;
}

const STORAGE_KEY = 'propaxis_active_user_id';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [activeUser, setActiveUser] = useState<UserAccount>(() => {
    const savedId = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    return SEED_USERS.find((u) => u.id === savedId) || SEED_USERS[0];
  });

  useEffect(() => {
    setApiSessionHeaders(activeUser.role, activeUser.id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, activeUser.id);
    }
  }, [activeUser]);

  const switchRole = (role: UserRole) => {
    const match = SEED_USERS.find((u) => u.role === role);
    if (match) {
      setApiSessionHeaders(match.role, match.id);
      setActiveUser(match);
      setIsAuthenticated(true);
      queryClient.invalidateQueries();
    }
  };

  const loginAsPersona = (userId: string) => {
    const match = SEED_USERS.find((u) => u.id === userId);
    if (match) {
      setApiSessionHeaders(match.role, match.id);
      setActiveUser(match);
      setIsAuthenticated(true);
      queryClient.invalidateQueries();
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user: activeUser,
        isAuthenticated,
        availablePersonas: SEED_USERS,
        switchRole,
        loginAsPersona,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
