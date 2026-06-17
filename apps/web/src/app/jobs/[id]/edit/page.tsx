'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { WorkType } from '@contractor-bidder/types';
import { api, uploadToSignedUrl } from '@/lib/api';
import { geocodeAddress, getBestCurrentPosition, reverseGeocode } from '@/lib/geocode';
import {
  defaultExactDate,
  defaultFlexibleRange,
  formatDateInputValue,
  formatJobDate,
  jobToTimeframeForm,
  parseDateInput,
  startOfDay,
  timeframeToApi,
  validateTimeframe,
  type TimeframeMode,
} from '@/lib/jobDates';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { inferImageContentType, imageExtensionForContentType } from '@/lib/uploadUtils';
import { formatPhoneDisplay, formatPhoneInput, phoneDigits, phoneForStorage } from '@/lib/phoneFormat';
import { SERVICE_TYPE_OPTIONS } from '@/lib/theme';
import { JobDescriptionSuggestions } from '@/components/JobDescriptionSuggestions';

const MAX_PHOTOS = 4;

interface PhotoDraft {
  id: string;
  previewUrl: string;
  fileUrl: string | null;
}

export default function EditJobPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id;
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [descriptionFetchToken, setDescriptionFetchToken] = useState(0);
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
  const [loadingJob, setLoadingJob] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!jobId) return;
    void (async () => {
      setLoadingJob(true);
      setError(null);
      try {
        const [job, bidList] = await Promise.all([
          api.getJob(jobId),
          api.listBids(jobId).catch(() => []),
        ]);
        if (bidList.length > 0) {
          setError('This job cannot be edited after a bid has been placed.');
          return;
        }
        if (job.status !== 'OPEN') {
          setError('Only open jobs can be edited.');
          return;
        }
        setTitle(job.title);
        setDescription(job.description);
        setWorkType(job.workType);
        setAddressText(job.addressText);
        if (job.contactPhone?.trim()) {
          setContactPhone(formatPhoneDisplay(job.contactPhone));
        }
        if (job.budgetMin != null) setBudgetMin(String(job.budgetMin / 100));
        if (job.budgetMax != null) setBudgetMax(String(job.budgetMax / 100));
        const tf = jobToTimeframeForm(job.desiredDatetimeStart, job.desiredDatetimeEnd);
        setTimeframeMode(tf.mode);
        setExactDate(tf.exactDate);
        setFlexibleStart(tf.flexibleStart);
        setFlexibleEnd(tf.flexibleEnd);
        setPhotos(
          job.photos.map((url, index) => ({
            id: `existing_${index}`,
            previewUrl: resolveMediaUrl(url),
            fileUrl: url,
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load job');
      } finally {
        setLoadingJob(false);
      }
    })();
  }, [jobId]);

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
      if (photo && photo.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId) return;
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

      await api.updateJob(jobId, {
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
        budgetMin: min,
        budgetMax: max,
      });
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save job');
    } finally {
      setBusy(false);
    }
  }

  const todayStr = formatDateInputValue(startOfDay(new Date()));

  if (loadingJob) return <p className="muted">Loading…</p>;

  if (error && !title) {
    return (
      <div>
        <h1 className="hero-headline">Edit job</h1>
        <p className="error">{error}</p>
        {jobId ? (
          <Link href={`/jobs/${jobId}`} className="btn-outline" style={{ display: 'inline-block', marginTop: 12 }}>
            Back to job
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <h1 className="hero-headline">Edit job</h1>
      <p className="page-subtitle">
        Update your job details. Editing is disabled once a contractor places a bid.
      </p>

      <form onSubmit={(e) => void submit(e)}>
        <div className="section">
          <p className="section-title">Job details</p>

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
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={() => setDescriptionFocused(true)}
            onBlur={() => {
              setDescriptionFocused(false);
              setDescriptionFetchToken((token) => token + 1);
            }}
            placeholder="What needs to be done? Include any details contractors should know…"
            required
            minLength={10}
          />

          <JobDescriptionSuggestions
            title={title}
            workType={workType}
            description={description}
            fetchToken={descriptionFetchToken}
            hidden={descriptionFocused}
            onAppend={(line) =>
              setDescription((prev) => {
                const trimmed = prev.trim();
                const prefix = trimmed.length ? `${trimmed}\n` : '';
                return `${prefix}• ${line}`;
              })
            }
          />

          <p className="field-label">Photos</p>
          <p className="field-hint">
            Optional — up to {MAX_PHOTOS} photos help contractors understand the job.
          </p>
          <div className="photo-row">
            {photos.map((photo) => (
              <div key={photo.id} className="photo-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt="" className="photo-thumb" />
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
                {uploading ? '…' : '+ Add photo'}
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
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {photos.length}/{MAX_PHOTOS} added
          </p>

          <p className="field-label">Type of work</p>
          <div className="chip-wrap">
            {SERVICE_TYPE_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`chip${workType === t.value ? ' active' : ''}`}
                onClick={() => setWorkType(t.value as WorkType)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <p className="section-title">Budget</p>
          <p className="field-hint">Optional — helps contractors know your price range.</p>
          <div className="row">
            <div>
              <label className="field-label" htmlFor="budgetMin">
                Min ($)
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
                Max ($)
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
        </div>

        <div className="section">
          <p className="section-title">Timeframe</p>
          <p className="field-hint">When would you like the work done?</p>
          <div className="chip-wrap">
            <button
              type="button"
              className={`chip${timeframeMode === 'exact' ? ' active' : ''}`}
              onClick={() => setTimeframeMode('exact')}
            >
              Exact date
            </button>
            <button
              type="button"
              className={`chip${timeframeMode === 'flexible' ? ' active' : ''}`}
              onClick={() => setTimeframeMode('flexible')}
            >
              I&apos;m flexible
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
              <p className="muted" style={{ marginTop: 6 }}>{formatJobDate(exactDate)}</p>
            </>
          ) : (
            <>
              <label className="field-label" htmlFor="flexStart">
                Earliest date
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
              <label className="field-label" htmlFor="flexEnd">
                Latest date
              </label>
              <input
                id="flexEnd"
                type="date"
                min={formatDateInputValue(flexibleStart)}
                value={formatDateInputValue(flexibleEnd)}
                onChange={(e) => setFlexibleEnd(parseDateInput(e.target.value))}
              />
            </>
          )}
        </div>

        <div className="section">
          <p className="section-title">Location</p>
          <p className="field-hint">
            Contractors see an approximate area on the map until you accept a bid.
          </p>
          <label className="field-label" htmlFor="address">
            Street address
          </label>
          <textarea
            id="address"
            rows={3}
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="123 Main St, Brooklyn, NY 11201"
            required
          />
          <button
            type="button"
            className="secondary-btn"
            disabled={locating || busy}
            onClick={() => void useCurrentLocation()}
          >
            {locating ? 'Getting location…' : '📍 Use my current location'}
          </button>
        </div>

        <div className="section">
          <p className="section-title">Contact</p>
          <p className="field-hint">
            Optional — shared with your chosen contractor after you accept a bid.
          </p>
          <label className="field-label" htmlFor="phone">
            Phone number
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

        {error && (
          <div className="error-box">
            <p className="error" style={{ margin: 0 }}>
              {error}
            </p>
          </div>
        )}

        <button type="submit" className="btn-primary btn-block" disabled={busy || uploading} style={{ marginTop: 8 }}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
