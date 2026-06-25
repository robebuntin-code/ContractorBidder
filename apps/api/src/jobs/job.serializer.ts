import type { Job } from '../generated/prisma/client';
import { extractPostalCode } from '../common/geo.util';
import { parsePhotoComparisons, type JobPhotoComparisonRecord } from './job-photo-comparison.util';

type PhotoResolver = (url: string) => string;

function resolvePhotos(photos: string[], resolvePhotoUrl?: PhotoResolver): string[] {
  return resolvePhotoUrl ? photos.map(resolvePhotoUrl) : photos;
}

function resolveComparisons(
  raw: unknown,
  resolvePhotoUrl?: PhotoResolver,
): JobPhotoComparisonRecord[] {
  return parsePhotoComparisons(raw).map((pair) => ({
    before: resolvePhotoUrl ? resolvePhotoUrl(pair.before) : pair.before,
    after: resolvePhotoUrl ? resolvePhotoUrl(pair.after) : pair.after,
  }));
}

/**
 * Privacy-preserving serializers. Non-owners MUST never receive the precise
 * address or coordinates of a job until they are the accepted contractor.
 */

export function toCoarseView(job: Job, distanceKm?: number, resolvePhotoUrl?: PhotoResolver) {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    workType: job.workType,
    desiredDatetimeStart: job.desiredDatetimeStart,
    desiredDatetimeEnd: job.desiredDatetimeEnd,
    photos: resolvePhotos(job.photos, resolvePhotoUrl),
    photoComparisons: resolveComparisons(job.photoComparisons, resolvePhotoUrl),
    budgetMin: job.budgetMin,
    budgetMax: job.budgetMax,
    currency: job.currency,
    status: job.status,
    createdByRole: job.createdByRole,
    createdByUserId: job.createdByUserId,
    coarseLat: job.coarseLat,
    coarseLng: job.coarseLng,
    postalCode: extractPostalCode(job.addressText),
    ...(distanceKm != null ? { distanceKm: Number(distanceKm.toFixed(1)) } : {}),
    createdAt: job.createdAt,
  };
}

export function toFullView(job: Job, resolvePhotoUrl?: PhotoResolver) {
  return {
    ...toCoarseView(job, undefined, resolvePhotoUrl),
    createdByUserId: job.createdByUserId,
    addressText: job.addressText,
    contactPhone: job.contactPhone,
    preciseLat: job.preciseLat,
    preciseLng: job.preciseLng,
    acceptedBidId: job.acceptedBidId,
  };
}
