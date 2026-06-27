'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkType } from '@contractor-bidder/types';
import { api, uploadToSignedUrl } from '@/lib/api';
import { geocodeAddress, getBestCurrentPosition, reverseGeocode } from '@/lib/geocode';
import { inferImageContentType, imageExtensionForContentType } from '@/lib/uploadUtils';
import {
  defaultExactDate,
  defaultFlexibleRange,
  formatDateInputValue,
  parseDateInput,
  startOfDay,
  timeframeToApi,
  validateTimeframe,
  type TimeframeMode,
} from '@/lib/jobDates';
import { formatPhoneDisplay, formatPhoneInput, phoneDigits, phoneForStorage } from '@/lib/phoneFormat';
import { SERVICE_TYPE_OPTIONS } from '@/lib/theme';
import { JobDescriptionSuggestions } from '@/components/JobDescriptionSuggestions';
import {
  JobPhotoAiEditButton,
  JobPhotoAiEditModal,
  type JobPhotoAiEditTarget,
} from '@/components/JobPhotoAiEdit';
import { ScopeComparisonDraftList, type ScopeComparisonDraft } from '@/components/JobScopeComparisons';
import { extractMediaKey } from '@/lib/mediaUrl';

const MAX_PHOTOS = 4;

interface PhotoDraft {
  id: string;
  previewUrl: string;
  fileUrl: string | null;
}

export default function NewJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workType, setWorkType] = useState<WorkType>('plumbing');
  const [addressText, setAddressText] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const flexDefaults = defaultFlexibleRange();
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>('exact');
  const [exactDate, setExactDate] = useState(defaultExactDate);
  const [flexibleStart, setFlexibleStart] = useState(flexDefaults.start);
  const [flexibleEnd, setFlexibleEnd] = useState(flexDefaults.end);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiEditTarget, setAiEditTarget] = useState<JobPhotoAiEditTarget | null>(null);
  const [scopeComparisons, setScopeComparisons] = useState<ScopeComparisonDraft[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api
      .me()
      .then((me) => {
        if (me.phone?.trim()) setContactPhone(formatPhoneDisplay(me.phone));
        if (me.homeAddress?.trim()) setAddressText(me.homeAddress.trim());
      })
      .catch(() => undefined);
  }, []);

  async function useCurrentLocation() {
    setError(null);
    setLocating(true);
    try {
      const { lat, lng } = await getBestCurrentPosition();
      setAddressText((await reverseGeocode(lat, lng)).label);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read your location.');
    } finally {
      setLocating(false);
    }
  }

  async function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || photos.length >= MAX_PHOTOS) return;

    setError(null);
    const contentType = inferImageContentType(file);
    const ext = imageExtensionForContentType(contentType);
    const fileName = `photo_${Date.now()}.${ext}`;
    const draftId = fileName;
    const previewUrl = URL.createObjectURL(file);

    setPhotos((prev) => [...prev, { id: draftId, previewUrl, fileUrl: null }]);
    setUploading(true);
    try {
      const signed = await api.signUpload(contentType, fileName);
      const fileUrl = await uploadToSignedUrl(signed, file, contentType);
      setPhotos((prev) => prev.map((p) => (p.id === draftId ? { ...p, fileUrl } : p)));
    } catch (err) {
      setPhotos((prev) => prev.filter((p) => p.id !== draftId));
      URL.revokeObjectURL(previewUrl);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function resolvePhotoSourceKey(target: JobPhotoAiEditTarget): Promise<string> {
    if (!target.fileUrl) {
      throw new Error('Wait for the photo to finish uploading.');
    }
    return extractMediaKey(target.fileUrl) ?? target.fileUrl;
  }

  function applyScopeComparison(
    photoId: string,
    result: {
      beforeKey: string;
      afterKey: string;
      beforePreview: string;
      afterPreview: string;
    },
  ) {
    setScopeComparisons((prev) => [
      ...prev,
      {
        id: `scope_${Date.now()}`,
        beforeKey: result.beforeKey,
        afterKey: result.afterKey,
        beforePreview: result.beforePreview,
        afterPreview: result.afterPreview,
      },
    ]);
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === photoId);
      if (photo?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((p) => p.id !== photoId);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError('Please enter a job title (at least 3 characters).');
      return;
    }
    if (description.trim().length < 10) {
      setError('Please describe the work needed (at least 10 characters).');
      return;
    }
    if (contactPhone.trim() && phoneDigits(contactPhone).length < 10) {
      setError('Please enter a valid 10-digit contact phone number.');
      return;
    }
    if (photos.some((p) => !p.fileUrl)) {
      setError('Please wait for photos to finish uploading.');
      return;
    }

    const timeframeError = validateTimeframe(timeframeMode, exactDate, flexibleStart, flexibleEnd);
    if (timeframeError) {
      setError(timeframeError);
      return;
    }

    setBusy(true);
    try {
      const { lat, lng } = await geocodeAddress(addressText);
      const min = budgetMin ? Math.round(Number(budgetMin) * 100) : undefined;
      const max = budgetMax ? Math.round(Number(budgetMax) * 100) : undefined;
      if (min != null && max != null && min > max) {
        setError('Minimum budget cannot be higher than maximum.');
        setBusy(false);
        return;
      }

      const job = await api.createJob({
        title: title.trim(),
        description: description.trim(),
        workType,
        ...timeframeToApi(timeframeMode, exactDate, flexibleStart, flexibleEnd),
        addressText: addressText.trim(),
        ...(phoneForStorage(contactPhone) ? { contactPhone: phoneForStorage(contactPhone) } : {}),
        lat,
        lng,
        photos: photos.length
          ? photos.map((p) => p.fileUrl).filter((url): url is string => !!url)
          : undefined,
        photoComparisons: scopeComparisons.length
          ? scopeComparisons.map((s) => ({ before: s.beforeKey, after: s.afterKey }))
          : undefined,
        budgetMin: min,
        budgetMax: max,
      });
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create job');
    } finally {
      setBusy(false);
    }
  }

  const todayStr = formatDateInputValue(startOfDay(new Date()));

  return (
    <div className="post-job-page">
      <p className="post-job-lead">
        Share what you need done. Your exact address stays private until you accept a bid.
      </p>

      <form className="post-job-form" onSubmit={(e) => void submit(e)}>
        <section className="post-job-block">
          <label className="field-label" htmlFor="workType">
            Type of work
          </label>
          <select
            id="workType"
            className="post-job-select"
            value={workType}
            onChange={(e) => setWorkType(e.target.value as WorkType)}
          >
            {SERVICE_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Replace water heater"
            required
            minLength={3}
          />

          <label className="field-label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs to be done?"
            required
            minLength={10}
          />

          <JobDescriptionSuggestions
            compact
            title={title}
            workType={workType}
            description={description}
            onAppend={(line) =>
              setDescription((prev) => {
                const trimmed = prev.trim();
                const prefix = trimmed.length ? `${trimmed}\n` : '';
                return `${prefix}• ${line}`;
              })
            }
          />
        </section>

        <section className="post-job-block">
          <div className="post-job-block-head">
            <span className="post-job-block-title">Photos</span>
            <span className="post-job-optional">Optional</span>
          </div>
          <p className="post-job-micro-hint">
            Add reference photos. Tap <strong>AI scope</strong> on a photo to create a before/after vision.
          </p>

          <ScopeComparisonDraftList
            compact
            items={scopeComparisons}
            onRemove={(id) => setScopeComparisons((prev) => prev.filter((s) => s.id !== id))}
          />

          <div className="photo-row">
            {photos.map((photo) => (
              <div key={photo.id} className="photo-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt="" className="photo-thumb" />
                <JobPhotoAiEditButton
                  disabled={busy || uploading || !photo.fileUrl}
                  onClick={() => setAiEditTarget(photo)}
                />
                <button type="button" className="photo-remove" onClick={() => removePhoto(photo.id)}>
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                className="photo-add"
                disabled={uploading || busy}
                onClick={() => photoInputRef.current?.click()}
              >
                {uploading ? '…' : '+ Photo'}
              </button>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            hidden
            onChange={(e) => void addPhoto(e)}
            disabled={uploading || busy}
          />
        </section>

        <section className="post-job-block">
          <p className="post-job-block-title">When</p>
          <div className="post-job-segment" role="group" aria-label="Timeframe">
            <button
              type="button"
              className={`post-job-segment-btn${timeframeMode === 'exact' ? ' active' : ''}`}
              onClick={() => setTimeframeMode('exact')}
            >
              Exact date
            </button>
            <button
              type="button"
              className={`post-job-segment-btn${timeframeMode === 'flexible' ? ' active' : ''}`}
              onClick={() => setTimeframeMode('flexible')}
            >
              Flexible
            </button>
          </div>

          {timeframeMode === 'exact' ? (
            <>
              <label className="field-label" htmlFor="exactDate">
                Preferred date
              </label>
              <input
                id="exactDate"
                type="date"
                min={todayStr}
                value={formatDateInputValue(exactDate)}
                onChange={(e) => setExactDate(parseDateInput(e.target.value))}
              />
            </>
          ) : (
            <div className="row">
              <div>
                <label className="field-label" htmlFor="flexStart">
                  From
                </label>
                <input
                  id="flexStart"
                  type="date"
                  min={todayStr}
                  value={formatDateInputValue(flexibleStart)}
                  onChange={(e) => {
                    const day = parseDateInput(e.target.value);
                    setFlexibleStart(day);
                    if (day > flexibleEnd) setFlexibleEnd(day);
                  }}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="flexEnd">
                  To
                </label>
                <input
                  id="flexEnd"
                  type="date"
                  min={formatDateInputValue(flexibleStart)}
                  value={formatDateInputValue(flexibleEnd)}
                  onChange={(e) => setFlexibleEnd(parseDateInput(e.target.value))}
                />
              </div>
            </div>
          )}
        </section>

        <section className="post-job-block">
          <p className="post-job-block-title">Where</p>
          <label className="sr-only" htmlFor="address">
            Street address
          </label>
          <textarea
            id="address"
            rows={2}
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="Street address, city, state, ZIP"
            required
          />
          <button
            type="button"
            className="post-job-link-btn"
            disabled={locating || busy}
            onClick={() => void useCurrentLocation()}
          >
            {locating ? 'Getting location…' : 'Use my current location'}
          </button>
        </section>

        <details className="post-job-details">
          <summary className="post-job-details-summary">
            <span>Budget &amp; phone</span>
            <span className="post-job-optional">Optional</span>
          </summary>
          <div className="post-job-details-body">
            <div className="row">
              <div>
                <label className="field-label" htmlFor="budgetMin">
                  Budget min ($)
                </label>
                <input
                  id="budgetMin"
                  type="number"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="500"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="budgetMax">
                  Budget max ($)
                </label>
                <input
                  id="budgetMax"
                  type="number"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="1200"
                />
              </div>
            </div>
            <label className="field-label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(formatPhoneInput(e.target.value))}
              placeholder="(555) 555-5555"
              autoComplete="tel"
            />
          </div>
        </details>

        {error ? (
          <div className="error-box">
            <p className="error" style={{ margin: 0 }}>
              {error}
            </p>
          </div>
        ) : null}

        <button type="submit" className="btn-primary btn-block post-job-submit" disabled={busy || uploading}>
          {busy ? 'Posting…' : 'Post job'}
        </button>
      </form>

      <JobPhotoAiEditModal
        target={aiEditTarget}
        onClose={() => setAiEditTarget(null)}
        resolveSourceKey={resolvePhotoSourceKey}
        onApply={applyScopeComparison}
      />
    </div>
  );
}
