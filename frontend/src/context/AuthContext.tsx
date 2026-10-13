import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, patch, post, setUnauthorizedHandler, tokenStore } from '../services/api';
import type { Role, SessionUser } from '../types';

interface AuthState {
  user: SessionUser | null;
  profile: any | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (payload: Record<string, unknown>) => Promise<SessionUser>;
  logout: () => void;
  updateProfile: (payload: Record<string, unknown>) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export const homeFor = (role: Role) => `/${role}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(!!tokenStore.get());
  const navigate = useNavigate();

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setProfile(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // Restore session on first load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    get<{ user: SessionUser; profile: any }>('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
        setProfile(data.profile);
      })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const apply = (d: { token?: string; user: SessionUser; profile: any }) => {
    if (d.token) tokenStore.set(d.token);
    setUser(d.user);
    setProfile(d.profile);
    return d.user;
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      login: async (email, password) => apply(await post('/auth/login', { email, password })),
      register: async (payload) => apply(await post('/auth/register', payload)),
      logout,
      updateProfile: async (payload) => {
        apply(await patch('/auth/profile', payload));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, profile, loading, logout]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
