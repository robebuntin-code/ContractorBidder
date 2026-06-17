'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatWorkType } from '@contractor-bidder/types';
import { api, type ContractorPublicProfile, type ContractorPublicReviewView } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/mediaUrl';

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} style={{ color: star <= rating ? '#f59e0b' : '#cbd5e1' }}>
          {star <= rating ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

function initials(first: string, last: string): string {
  return `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() || '?';
}

function milesFromKm(km: number): string {
  return `${Math.round(km / 1.60934)} mi`;
}

export default function ContractorProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;
  const [profile, setProfile] = useState<ContractorPublicProfile | null>(null);
  const [reviews, setReviews] = useState<ContractorPublicReviewView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [profileRes, reviewsRes] = await Promise.all([
        api.getContractorProfile(userId),
        api.getContractorReviews(userId).catch(() => [] as ContractorPublicReviewView[]),
      ]);
      setProfile(profileRes);
      setReviews(reviewsRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load contractor profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="muted">Loading contractor profile…</p>;
  if (error || !profile) {
    return (
      <p className="error">
        {error ?? 'Profile not found'} — <Link href="/jobs">back to jobs</Link>
      </p>
    );
  }

  const displayName =
    profile.companyName?.trim() ||
    `${profile.firstName} ${profile.lastName}`.trim() ||
    'Contractor';

  return (
    <div>
      <p className="muted">
        <Link href="/jobs">← Back</Link>
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        {profile.logoUrl?.trim() ? (
          <img
            src={resolveMediaUrl(profile.logoUrl)}
            alt={`${displayName} logo`}
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              objectFit: 'cover',
              border: '1px solid #e2e8f0',
            }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: '#2563eb',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {initials(profile.firstName, profile.lastName)}
          </div>
        )}
        <div>
          <h1 style={{ margin: 0 }}>{displayName}</h1>
          {profile.companyName ? (
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {profile.firstName} {profile.lastName}
            </p>
          ) : null}
          <p className="muted" style={{ margin: '4px 0 0' }}>
            ⭐ {profile.ratingAgg} · {profile.ratingCount} reviews
          </p>
        </div>
      </div>

      {profile.description ? (
        <div className="card">
          <h3>About</h3>
          <p>{profile.description}</p>
        </div>
      ) : null}

      <div className="card">
        <h3>Contact</h3>
        <p>
          <strong>Phone:</strong>{' '}
          {profile.phone?.trim() ? (
            <a href={`tel:${profile.phone}`}>{profile.phone}</a>
          ) : (
            'Not provided'
          )}
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Address:</strong> {profile.businessAddress?.trim() || 'Not provided'}
        </p>
      </div>

      <div className="card">
        <h3>Services</h3>
        {profile.serviceTypes.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {profile.serviceTypes.map((t) => (
              <span key={t} className="badge">
                {formatWorkType(t)}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">No service types listed.</p>
        )}
        <p className="muted" style={{ marginTop: 12 }}>
          Service radius: {milesFromKm(profile.serviceRadiusKm)}
        </p>
      </div>

      <div className="card">
        <h3>Reviews ({reviews.length})</h3>
        {reviews.length === 0 ? (
          <p className="muted">No reviews yet from completed jobs.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {reviews.map((review, index) => (
              <li
                key={review.id}
                style={{
                  padding: '12px 0',
                  borderTop: index > 0 ? '1px solid #e2e8f0' : undefined,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <StarRating rating={review.rating} />
                  <span className="muted">{formatReviewDate(review.createdAt)}</span>
                </div>
                <p className="muted" style={{ margin: '4px 0 6px', fontSize: 13 }}>
                  {review.reviewerName} · {review.jobTitle}
                </p>
                {review.comment ? <p style={{ margin: 0 }}>{review.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Credentials</h3>
        <p>
          <strong>License:</strong> {profile.licenseNumber?.trim() || 'Not provided'}
        </p>
        {profile.googleReviewsUrl ? (
          <p style={{ marginTop: 12 }}>
            <a href={profile.googleReviewsUrl} target="_blank" rel="noreferrer">
              View Google reviews
            </a>
          </p>
        ) : (
          <p className="muted" style={{ marginTop: 8 }}>
            No Google reviews link provided.
          </p>
        )}
      </div>
    </div>
  );
}
