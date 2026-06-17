'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { JobFullView } from '@contractor-bidder/types';
import { formatBudget } from '@contractor-bidder/ui';
import { api } from '@/lib/api';

export default function MyJobsPage() {
  const [jobs, setJobs] = useState<JobFullView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setJobs(await api.myJobs());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmDelete(job: JobFullView) {
    if (job.status === 'AWARDED') {
      alert('Awarded jobs cannot be removed.');
      return;
    }
    if (!window.confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    void deleteJob(job.id);
  }

  async function deleteJob(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not delete job');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (error) {
    return (
      <div>
        <h1 className="hero-headline">My Jobs</h1>
        <p className="error">
          {error} — <Link href="/login">sign in</Link> first.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="hero-panel" style={{ marginBottom: 24 }}>
        <h1 className="hero-headline">Manage your jobs</h1>
        <p className="page-subtitle">Post work, review bids, and hire contractors.</p>
        <Link href="/jobs/new">
          <button type="button" className="btn-primary" style={{ marginTop: 8 }}>
            + Post a Job
          </button>
        </Link>
      </div>

      {jobs.length === 0 && (
        <p className="muted">You haven&apos;t posted any jobs yet.</p>
      )}

      {jobs.map((job) => (
        <div key={job.id} className="card card-row">
          <Link href={`/jobs/${job.id}`} className="card-body" style={{ color: 'inherit' }}>
            <span className="badge">{job.status}</span>
            <p className="job-title">{job.title}</p>
            <p className="muted" style={{ margin: 0 }}>
              {formatBudget(job)} · {job.addressText}
            </p>
          </Link>
          <button
            type="button"
            className="icon-btn danger"
            disabled={busy || job.status === 'AWARDED'}
            aria-label="Delete job"
            onClick={() => confirmDelete(job)}
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}
