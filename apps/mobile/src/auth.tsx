import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAccessToken, setSessionExpiredHandler, type PublicUser } from './api';

const ACCESS_KEY = 'cb_access';
const REFRESH_KEY = 'cb_refresh';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'HOMEOWNER' | 'CONTRACTOR';
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAccessToken(null);
      setUser(null);
      void AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // Restore a persisted session on launch.
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(ACCESS_KEY);
        if (token) {
          setAccessToken(token);
          const me = await api.me();
          setUser(me);
        }
      } catch {
        await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function persist(accessToken: string, refreshToken: string, u: PublicUser) {
    setAccessToken(accessToken);
    await AsyncStorage.multiSet([
      [ACCESS_KEY, accessToken],
      [REFRESH_KEY, refreshToken],
    ]);
    setUser(u);
  }

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const res = await api.login(email, password);
        await persist(res.accessToken, res.refreshToken, res.user);
      },
      register: async (input) => {
        const res = await api.register(input);
        await persist(res.accessToken, res.refreshToken, res.user);
      },
      logout: async () => {
        await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
        setAccessToken(null);
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
