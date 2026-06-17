'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { useAuth } from './AuthProvider';
import { TabIcon } from './TabIcons';

type TabId = 'find' | 'jobs' | 'activity' | 'profile';

function activeTab(pathname: string, isContractor: boolean): TabId {
  if (pathname.startsWith('/activity')) return 'activity';
  if (pathname.startsWith('/profile') || pathname.startsWith('/contractors/')) return 'profile';
  if (pathname.startsWith('/my-jobs') || pathname === '/jobs/new') return 'jobs';
  if (pathname.startsWith('/jobs')) {
    return isContractor ? 'find' : 'jobs';
  }
  return isContractor ? 'find' : 'jobs';
}

function tabClass(active: boolean): string {
  return `tab-item${active ? ' active' : ''}`;
}

export default function BottomTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const isContractor = user?.role === 'CONTRACTOR';
  const current = activeTab(pathname, isContractor);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount((await api.unreadNotifications()).length);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread, pathname]);

  useRealtime(undefined, {
    onNotification: () => void refreshUnread(),
  });

  if (!user) return null;

  return (
    <nav className="tab-bar" aria-label="Main">
      {isContractor && (
        <Link href="/jobs" className={tabClass(current === 'find')}>
          <span className={`tab-icon-wrap${current === 'find' ? ' active' : ''}`}>
            <TabIcon name="find" active={current === 'find'} />
          </span>
          <span className="tab-label">Find</span>
        </Link>
      )}
      <Link href="/my-jobs" className={tabClass(current === 'jobs')}>
        <span className={`tab-icon-wrap${current === 'jobs' ? ' active' : ''}`}>
          <TabIcon name="jobs" active={current === 'jobs'} />
        </span>
        <span className="tab-label">Jobs</span>
      </Link>
      <Link href="/activity" className={tabClass(current === 'activity')}>
        <span className={`tab-icon-wrap${current === 'activity' ? ' active' : ''}`}>
          <TabIcon name="activity" active={current === 'activity'} />
          {unreadCount > 0 && (
            <span className="tab-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </span>
        <span className="tab-label">Activity</span>
      </Link>
      <Link href="/profile" className={tabClass(current === 'profile')}>
        <span className={`tab-icon-wrap${current === 'profile' ? ' active' : ''}`}>
          <TabIcon name="profile" active={current === 'profile'} />
        </span>
        <span className="tab-label">Profile</span>
      </Link>
    </nav>
  );
}
