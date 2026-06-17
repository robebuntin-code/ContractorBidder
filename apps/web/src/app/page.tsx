'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const target = !user
      ? '/login'
      : user.role === 'CONTRACTOR'
        ? '/jobs'
        : '/my-jobs';
    router.replace(target);
  }, [user, loading, router]);

  // Hard fallback if client navigation fails (stale bundle, router issues).
  useEffect(() => {
    if (loading) return;
    const target = !user
      ? '/login'
      : user.role === 'CONTRACTOR'
        ? '/jobs'
        : '/my-jobs';
    const timer = setTimeout(() => {
      if (window.location.pathname === '/') {
        window.location.replace(target);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, loading]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <p className="muted">Loading…</p>
        <p className="field-hint" style={{ marginTop: 12 }}>
          If this takes more than a few seconds, the API may not be running.
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href="/login">Continue to sign in →</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <p className="muted">Redirecting…</p>
      <p style={{ marginTop: 16 }}>
        <Link href="/login">Go to sign in</Link>
      </p>
    </div>
  );
}
