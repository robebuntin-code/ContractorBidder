'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type NotificationItem } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';

const LABELS: Record<string, string> = {
  JOB_MATCH: 'New matching job',
  NEW_BID: 'New bid on your job',
  BID_SUBMITTED: 'Bid submitted',
  BID_ACCEPTED: 'Your bid was accepted',
  MESSAGE: 'New message',
  PAYMENT_REQUIRED: 'Payment required',
};

function notificationBody(item: NotificationItem): string {
  const message = item.data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  const title = item.data?.title;
  if (typeof title === 'string' && title.trim()) return title;
  return '';
}

export default function ActivityPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await api.notifications());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load activity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime(undefined, {
    onNotification: () => {
      void load();
    },
  });

  async function markAllRead() {
    if (busy) return;
    setBusy(true);
    try {
      await api.markNotificationsRead();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (busy) return;
    if (
      !window.confirm(
        'Clear activity? This removes all notifications from your feed. This cannot be undone.',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.clearNotifications();
      setItems([]);
    } catch {
      alert('Could not clear activity. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function clearOne(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.clearNotifications([id]);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch {
      alert('Could not clear entry. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const hasUnread = items.some((i) => !i.readAt);

  if (loading) return <p className="muted">Loading activity…</p>;

  if (loadError && items.length === 0) {
    return (
      <div>
        <h1 className="hero-headline">Activity</h1>
        <p className="error">
          {loadError} — <Link href="/login">sign in</Link> first.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="hero-headline">Activity</h1>
      <p className="page-subtitle">Bids, messages, and job updates in one place.</p>
      {loadError && <p className="error">{loadError}</p>}

      {items.length > 0 && (
        <div className="actions-row">
          {hasUnread ? (
            <button type="button" className="action-link" disabled={busy} onClick={() => void markAllRead()}>
              Mark all read
            </button>
          ) : null}
          <button type="button" className="action-link danger" disabled={busy} onClick={() => void clearAll()}>
            Clear all
          </button>
        </div>
      )}

      {items.length === 0 && <p className="muted">No activity yet.</p>}

      {items.map((item) => {
        const jobId = item.data?.jobId as string | undefined;
        return (
          <div
            key={item.id}
            className={`card card-row${!item.readAt ? ' card-unread' : ''}`}
          >
            <div className="card-body">
              {jobId ? (
                <Link href={`/jobs/${jobId}`}>
                  <span className="badge">{LABELS[item.type] ?? item.type}</span>
                  <p style={{ margin: '4px 0 0' }}>{notificationBody(item)}</p>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </Link>
              ) : (
                <>
                  <span className="badge">{LABELS[item.type] ?? item.type}</span>
                  <p style={{ margin: '4px 0 0' }}>{notificationBody(item)}</p>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              className="icon-btn"
              disabled={busy}
              aria-label="Clear notification"
              onClick={() => void clearOne(item.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
