'use client';

import { useEffect, useMemo, useState } from 'react';
import { mediaDownloadCandidates } from '@/lib/mediaUrl';

interface RemotePhotoProps {
  uri: string;
  alt: string;
  className?: string;
  missingClassName?: string;
}

/** Job/profile photo with URL fallbacks and a visible placeholder when the file is missing. */
export function RemotePhoto({
  uri,
  alt,
  className,
  missingClassName = 'job-detail-photo job-detail-photo--missing',
}: RemotePhotoProps) {
  const candidates = useMemo(() => mediaDownloadCandidates(uri), [uri]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setFailed(false);
  }, [uri, candidates]);

  if (!uri.trim() || failed || candidates.length === 0) {
    return (
      <div className={missingClassName} role="img" aria-label={alt}>
        <span className="job-detail-photo-missing-label">Photo unavailable</span>
        <span className="job-detail-photo-missing-hint">
          The image file may have been lost during a server update. Edit the job and re-upload
          photos.
        </span>
      </div>
    );
  }

  const src = candidates[candidateIndex] ?? uri;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        if (candidateIndex + 1 < candidates.length) {
          setCandidateIndex((index) => index + 1);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

interface JobPhotoGalleryProps {
  photos: string[];
}

export function JobPhotoGallery({ photos }: JobPhotoGalleryProps) {
  if (!photos.length) return null;

  return (
    <div className="job-detail-photos-section">
      <h3 className="job-detail-photos-title">Photos</h3>
      <div className="job-detail-photos">
        {photos.map((uri) => (
          <RemotePhoto key={uri} uri={uri} alt="Job photo" className="job-detail-photo" />
        ))}
      </div>
    </div>
  );
}
