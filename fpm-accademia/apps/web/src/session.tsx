import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role } from '@fpm/shared';
import { ApiError, get, post } from './lib/api.js';

export interface Me {
  id: string;
  role: Role;
  displayName: string;
  email: string;
}

interface SessionValue {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await get<Me>('/api/me'));
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 401) setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await post('/api/auth/logout').catch(() => {});
    setMe(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <SessionContext.Provider value={{ me, loading, refresh, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession fuori da SessionProvider');
  return v;
}
