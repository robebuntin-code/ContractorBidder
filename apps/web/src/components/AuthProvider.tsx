'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokenStore, type MeView } from '@/lib/api';

const AUTH_CHANGE = 'dojobid-auth-change';

export function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_CHANGE));
}

interface AuthContextValue {
  user: MeView | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => undefined,
  logout: () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<MeView | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setUser(await api.me());
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setLoading(false);
    notifyAuthChange();
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(AUTH_CHANGE, onChange);
    return () => window.removeEventListener(AUTH_CHANGE, onChange);
  }, [refresh]);

  // Never block the UI forever if auth check hangs.
  useEffect(() => {
    const failSafe = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          tokenStore.clear();
          setUser(null);
        }
        return false;
      });
    }, 12000);
    return () => clearTimeout(failSafe);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
