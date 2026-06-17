import { Job } from '../generated/prisma/client';
import { extractPostalCode } from '../common/geo.util';

/**
 * Privacy-preserving serializers. Non-owners MUST never receive the precise
 * address or coordinates of a job until they are the accepted contractor.
 */

export function toCoarseView(job: Job, distanceKm?: number) {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    workType: job.workType,
    desiredDatetimeStart: job.desiredDatetimeStart,
    desiredDatetimeEnd: job.desiredDatetimeEnd,
    photos: job.photos,
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

export function toFullView(job: Job) {
  return {
    ...toCoarseView(job),
    createdByUserId: job.createdByUserId,
    addressText: job.addressText,
    contactPhone: job.contactPhone,
    preciseLat: job.preciseLat,
    preciseLng: job.preciseLng,
    acceptedBidId: job.acceptedBidId,
  };
}

/**
 * Decide which view a requester is entitled to. The owner and the accepted
 * contractor get the full view; everyone else gets coarse.
 */
export function canSeePreciseLocation(
  job: Job,
  requester: { userId: string } | undefined,
  acceptedContractorUserId: string | null | undefined,
): boolean {
  if (!requester) return false;
  if (job.createdByUserId === requester.userId) return true;
  if (acceptedContractorUserId && acceptedContractorUserId === requester.userId) return true;
  return false;
}
