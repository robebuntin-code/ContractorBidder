import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import { useRealtime } from './realtime';

interface UnreadNotificationsContextValue {
  unreadCount: number;
  refresh: () => Promise<void>;
}

const UnreadNotificationsContext = createContext<UnreadNotificationsContextValue | undefined>(
  undefined,
);

export function UnreadNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const items = await api.unreadNotifications();
      setUnreadCount(items.length);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtime(undefined, {
    onNotification: () => {
      void refresh();
    },
  });

  const value = useMemo(() => ({ unreadCount, refresh }), [unreadCount, refresh]);

  return (
    <UnreadNotificationsContext.Provider value={value}>
      {children}
    </UnreadNotificationsContext.Provider>
  );
}

export function useUnreadNotifications(): UnreadNotificationsContextValue {
  const ctx = useContext(UnreadNotificationsContext);
  if (!ctx) {
    throw new Error('useUnreadNotifications must be used within UnreadNotificationsProvider');
  }
  return ctx;
}
