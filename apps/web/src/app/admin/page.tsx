'use client';

import { useCallback, useEffect, useState } from 'react';
import type { JobFullView } from '@contractor-bidder/types';
import { api, type AdminUser } from '@/lib/api';

type Tab = 'jobs' | 'users';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<JobFullView[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (tab === 'jobs') {
        setJobs((await api.adminJobs()).items);
      } else {
        setUsers((await api.adminUsers()).items);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load (admin only)');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleBan(u: AdminUser) {
    try {
      if (u.isBanned) await api.unbanUser(u.id);
      else await api.banUser(u.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  }

  return (
    <div>
      <h1>Admin</h1>
      <p className="muted">Sign in as the seeded admin (`admin@example.com`) to use this page.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={tab === 'jobs' ? '' : 'secondary'}
          onClick={() => setTab('jobs')}
        >
          Jobs
        </button>
        <button
          className={tab === 'users' ? '' : 'secondary'}
          onClick={() => setTab('users')}
        >
          Users
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}

      {tab === 'jobs' &&
        jobs.map((job) => (
          <div key={job.id} className="card">
            <span className="badge">{job.status}</span>
            <strong style={{ marginLeft: 8 }}>{job.title}</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {job.workType} · {job.addressText} · created {new Date(job.createdAt).toLocaleString()}
            </p>
          </div>
        ))}

      {tab === 'users' &&
        users.map((u) => (
          <div key={u.id} className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <strong>
                {u.firstName} {u.lastName}
              </strong>{' '}
              <span className="badge">{u.role}</span>
              {u.isBanned && (
                <span className="badge" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  BANNED
                </span>
              )}
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {u.email}
              </p>
            </div>
            {u.role !== 'ADMIN' && (
              <button
                className={u.isBanned ? 'secondary' : ''}
                style={u.isBanned ? {} : { background: '#dc2626' }}
                onClick={() => toggleBan(u)}
              >
                {u.isBanned ? 'Unban' : 'Ban'}
              </button>
            )}
          </div>
        ))}
    </div>
  );
}
