'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import type { JobCoarseView } from '@contractor-bidder/types';
import { formatWorkType } from '@contractor-bidder/types';
import { formatBudget } from '@contractor-bidder/ui';
import { api } from '@/lib/api';
import {
  formatAccuracyMiles,
  geocodeAddress,
  getBestCurrentPosition,
  reverseGeocode,
} from '@/lib/geocode';
import { normalizeAddressDisplay } from '@/lib/addressFormat';
import { SERVICE_TYPE_OPTIONS } from '@/lib/theme';

const JobsMap = dynamic(() => import('@/components/JobsMap'), {
  ssr: false,
  loading: () => <div className="jobs-map jobs-map-loading">Loading map…</div>,
});

const MIN_RADIUS_MILES = 1;
const MAX_RADIUS_MILES = 100;
const WORK_TYPE_FILTERS = [{ value: '', label: 'All trades' }, ...SERVICE_TYPE_OPTIONS];

type SearchCenter = {
  lat: number;
  lng: number;
  label: string;
  source: 'device' | 'address';
  accuracyMeters?: number;
};

type PendingGps = {
  lat: number;
  lng: number;
  label: string;
  accuracyMeters: number;
};

function formatDistanceMiles(distanceKm?: number | null): string | null {
  if (distanceKm == null) return null;
  const miles = distanceKm * 0.621371;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

export default function JobsPage() {
  const [center, setCenter] = useState<SearchCenter | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [pendingGps, setPendingGps] = useState<PendingGps | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [workType, setWorkType] = useState('');
  const [jobs, setJobs] = useState<JobCoarseView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    void api
      .me()
      .then(async (me) => {
        if (me.role === 'CONTRACTOR') {
          try {
            const profile = await api.myContractorProfile();
            if (profile.baseLat != null && profile.baseLng != null) {
              try {
                const reversed = await reverseGeocode(profile.baseLat, profile.baseLng);
                setAddressQuery(reversed.label);
                return;
              } catch {
                /* fall back to saved address text */
              }
            }
            if (profile.businessAddress?.trim()) {
              setAddressQuery(normalizeAddressDisplay(profile.businessAddress));
              return;
            }
          } catch {
            /* no profile yet */
          }
        }
        if (me.homeAddress?.trim()) {
          setAddressQuery(normalizeAddressDisplay(me.homeAddress));
        }
      })
      .catch(() => undefined);
  }, []);

  const runSearch = useCallback(
    async (searchCenter: SearchCenter) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.searchJobs({
          lat: searchCenter.lat,
          lng: searchCenter.lng,
          radiusKm: radiusMiles * 1.60934,
          workType: workType || undefined,
        });
        setJobs(res.items);
        setHasSearched(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    [radiusMiles, workType],
  );

  const useCurrentLocation = useCallback(async () => {
    setLocating(true);
    setError(null);
    setPendingGps(null);
    setCenter(null);
    setHasSearched(false);
    setJobs([]);
    try {
      const gps = await getBestCurrentPosition();
      const reversed = await reverseGeocode(gps.lat, gps.lng);
      setAddressQuery(reversed.label);
      setPendingGps({
        lat: gps.lat,
        lng: gps.lng,
        label: reversed.label,
        accuracyMeters: gps.accuracyMeters,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read your location.');
    } finally {
      setLocating(false);
    }
  }, []);

  const confirmGpsLocation = useCallback(async () => {
    if (!pendingGps) return;
    const nextCenter: SearchCenter = {
      lat: pendingGps.lat,
      lng: pendingGps.lng,
      label: pendingGps.label,
      source: 'device',
      accuracyMeters: pendingGps.accuracyMeters,
    };
    setPendingGps(null);
    setCenter(nextCenter);
    await runSearch(nextCenter);
  }, [pendingGps, runSearch]);

  const applyAddress = useCallback(async () => {
    const trimmed = normalizeAddressDisplay(addressQuery);
    if (trimmed.length < 3) {
      setError('Enter an address with city and state, e.g. "123 Main St, Atlanta, GA".');
      return;
    }
    setGeocoding(true);
    setError(null);
    setPendingGps(null);
    try {
      const result = await geocodeAddress(trimmed);
      setAddressQuery(result.label);
      const nextCenter: SearchCenter = {
        lat: result.lat,
        lng: result.lng,
        label: result.label,
        source: 'address',
      };
      setCenter(nextCenter);
      await runSearch(nextCenter);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not look up that address.');
    } finally {
      setGeocoding(false);
    }
  }, [addressQuery, runSearch]);

  useEffect(() => {
    if (!center) return;
    void runSearch(center);
  }, [radiusMiles, workType]); // eslint-disable-line react-hooks/exhaustive-deps -- re-filter only

  const areaBusy = locating || geocoding;
  const resultSummary =
    loading && !hasSearched
      ? 'Searching nearby…'
      : hasSearched
        ? jobs.length === 0
          ? 'No jobs in this area'
          : `${jobs.length} job${jobs.length === 1 ? '' : 's'} nearby`
        : null;

  return (
    <div className="find-jobs-page">
      <header className="find-jobs-header">
        <h1 className="hero-headline">Find jobs near you</h1>
        <p className="page-subtitle">Search by area, filter by trade, and browse jobs on the map or list.</p>
      </header>

      <section className="find-jobs-search card">
        <div className="find-jobs-search-row">
          <div className="find-jobs-address">
            <label className="field-label" htmlFor="search-address">
              Search area
            </label>
            <input
              id="search-address"
              value={addressQuery}
              onChange={(e) => {
                setAddressQuery(e.target.value);
                if (pendingGps) setPendingGps(null);
              }}
              placeholder="123 Main St, Atlanta, GA 30303"
              onKeyDown={(e) => e.key === 'Enter' && void applyAddress()}
              disabled={areaBusy}
            />
          </div>
          <div className="find-jobs-search-actions">
            <button
              type="button"
              className="address-btn secondary"
              disabled={areaBusy}
              onClick={() => void useCurrentLocation()}
            >
              {locating ? 'Getting GPS…' : 'Current location'}
            </button>
            <button
              type="button"
              className="address-btn primary"
              disabled={areaBusy}
              onClick={() => void applyAddress()}
            >
              {geocoding ? 'Searching…' : 'Search here'}
            </button>
          </div>
        </div>

        <p className="field-hint">
          Type your full address with city and state for best results. Browser GPS on laptops is often
          inaccurate.
        </p>

        {pendingGps ? (
          <div className="location-confirm">
            <p className="location-confirm-title">Is this your location?</p>
            <p className="location-text">{pendingGps.label}</p>
            <p className="field-hint">
              GPS accuracy: {formatAccuracyMiles(pendingGps.accuracyMeters)}. If this looks wrong, tap
              &quot;No, edit address&quot; and search with your typed address instead.
            </p>
            <div className="location-confirm-actions">
              <button type="button" className="btn-primary" onClick={() => void confirmGpsLocation()}>
                Yes, search here
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setPendingGps(null);
                  setError('Update the address above, then tap Search here.');
                }}
              >
                No, edit address
              </button>
            </div>
          </div>
        ) : null}

        {center && !pendingGps ? (
          <div className="find-jobs-active">
            <span className="find-jobs-active-label">Searching near</span>
            <span className="find-jobs-active-value">{center.label}</span>
            <button
              type="button"
              className="action-link"
              onClick={() => {
                setCenter(null);
                setJobs([]);
                setHasSearched(false);
                setAddressQuery('');
              }}
            >
              Change
            </button>
          </div>
        ) : null}

        <div className="find-jobs-filters">
          <div className="find-jobs-filter-block">
            <div className="slider-header">
              <span className="field-label" style={{ margin: 0 }}>
                Search radius
              </span>
              <span className="slider-value">
                {radiusMiles >= MAX_RADIUS_MILES ? '100+ mi' : `${radiusMiles} mi`}
              </span>
            </div>
            <input
              type="range"
              min={MIN_RADIUS_MILES}
              max={MAX_RADIUS_MILES}
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value))}
              disabled={!center}
            />
            <div className="slider-labels">
              <span>{MIN_RADIUS_MILES} mi</span>
              <span>100+ mi</span>
            </div>
          </div>

          <div className="find-jobs-filter-block">
            <p className="field-label" style={{ marginTop: 0 }}>
              Trade
            </p>
            <div className="chip-wrap">
              {WORK_TYPE_FILTERS.map((t) => (
                <button
                  key={t.value || 'all'}
                  type="button"
                  className={`chip${workType === t.value ? ' active' : ''}`}
                  onClick={() => setWorkType(t.value)}
                  disabled={!center}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="error-box">
          <p className="error" style={{ margin: 0 }}>
            {error}
          </p>
        </div>
      ) : null}

      {!center && !pendingGps && !loading ? (
        <p className="muted find-jobs-empty-hint">
          Enter your address or confirm your GPS location to search for jobs.
        </p>
      ) : null}

      {center && !pendingGps ? (
        <section className="find-jobs-results">
          <div className="find-jobs-results-header">
            <p className="find-jobs-results-summary">{resultSummary ?? 'Ready to search'}</p>
            <p className="field-hint find-jobs-map-note">
              Map pins show approximate job areas (~1 km), not exact addresses.
            </p>
          </div>

          <div className="find-jobs-split">
            <div className="find-jobs-list">
              {loading ? <p className="muted">Updating results…</p> : null}
              {!loading && hasSearched && jobs.length === 0 ? (
                <div className="find-jobs-no-results card">
                  <p className="job-title" style={{ marginTop: 0 }}>
                    No jobs match
                  </p>
                  <p className="muted" style={{ margin: 0 }}>
                    Try a wider radius, choose All trades, or search a different address.
                  </p>
                </div>
              ) : null}
              {jobs.map((job) => {
                const distance = formatDistanceMiles(job.distanceKm);
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="job-card"
                    style={{ display: 'block', color: 'inherit' }}
                  >
                    <div className="job-card-top">
                      <span className="badge">{formatWorkType(job.workType)}</span>
                      {distance ? <span className="badge">{distance}</span> : null}
                    </div>
                    <p className="job-title">{job.title}</p>
                    <p className="muted" style={{ margin: '0 0 8px' }}>
                      {formatBudget(job)}
                    </p>
                    <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.4 }}>{job.description}</p>
                    <span className="job-card-action">View job →</span>
                  </Link>
                );
              })}
            </div>

            <aside className="find-jobs-map-panel">
              <JobsMap jobs={jobs} center={{ lat: center.lat, lng: center.lng }} radiusMiles={radiusMiles} />
            </aside>
          </div>
        </section>
      ) : null}
    </div>
  );
}
