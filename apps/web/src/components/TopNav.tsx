'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandLogo from './BrandLogo';
import { HowDojobidWorksLink } from './HowDojobidWorks';
import { useAuth } from './AuthProvider';

function navLinkClass(active: boolean): string {
  return `top-nav-link${active ? ' active' : ''}`;
}

export default function TopNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isContractor = user?.role === 'CONTRACTOR';
  const isLogin = pathname === '/login';

  const findActive = pathname === '/jobs' || pathname.startsWith('/jobs/');
  const jobsActive = pathname.startsWith('/my-jobs') || pathname === '/jobs/new';
  const activityActive = pathname.startsWith('/activity');
  const profileActive = pathname.startsWith('/profile') || pathname.startsWith('/contractors/');

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <Link href={user ? (isContractor ? '/jobs' : '/my-jobs') : '/login'} className="top-nav-brand">
          <BrandLogo size="nav" />
        </Link>

        {user && !isLogin ? (
          <nav className="top-nav-links" aria-label="Main">
            {isContractor ? (
              <Link href="/jobs" className={navLinkClass(findActive && !jobsActive)}>
                Find jobs
              </Link>
            ) : null}
            <Link href="/my-jobs" className={navLinkClass(jobsActive)}>
              My jobs
            </Link>
            <Link href="/activity" className={navLinkClass(activityActive)}>
              Activity
            </Link>
            <Link href="/profile" className={navLinkClass(profileActive)}>
              Profile
            </Link>
          </nav>
        ) : (
          <nav className="top-nav-links" aria-label="Main">
            <HowDojobidWorksLink className="top-nav-link" />
          </nav>
        )}

        <div className="top-nav-actions">
          {user && !isLogin ? (
            <>
              <HowDojobidWorksLink className="top-nav-text-btn" />
              <button type="button" className="top-nav-text-btn" onClick={() => void logout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <HowDojobidWorksLink className="top-nav-text-btn" />
              <Link href="/login" className="top-nav-text-btn">
                Log in
              </Link>
              <Link href="/login" className="top-nav-signup">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
