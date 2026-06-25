'use client';

import { usePathname } from 'next/navigation';
import BottomTabBar from './BottomTabBar';
import StackHeader from './StackHeader';
import TopNav from './TopNav';
import { useAuth } from './AuthProvider';

function getStackTitle(pathname: string): string | null {
  if (pathname === '/jobs/new') return 'Post a job';
  if (/^\/jobs\/[^/]+\/edit$/.test(pathname)) return 'Edit job';
  if (pathname === '/admin') return 'Admin';
  if (/^\/jobs\/[^/]+$/.test(pathname)) return 'Job details';
  if (/^\/contractors\/[^/]+$/.test(pathname)) return 'Contractor';
  return null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const isLogin = pathname === '/login';
  const isDownload = pathname === '/download';
  const isBareScreen = isLogin || isDownload;
  const showTabs = !!user && !isBareScreen;
  const stackTitle = getStackTitle(pathname);
  const showStackHeader = showTabs && stackTitle !== null;

  return (
    <div className="app-frame">
      <div className="app-shell">
        <TopNav />
        {showStackHeader && <StackHeader title={stackTitle} />}
        <main
          className={[
            'app-content',
            showTabs ? 'has-tabs' : '',
            showStackHeader ? 'has-stack-header' : '',
            isBareScreen ? 'bare-screen' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </main>
        {showTabs && <BottomTabBar />}
      </div>
    </div>
  );
}
