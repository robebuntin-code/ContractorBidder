import { Bid, ContractorProfile, User } from '../generated/prisma/client';

type BidWithContractor = Bid & {
  contractor?: (User & { contractorProfile?: ContractorProfile | null }) | null;
};

/**
 * Serialize a bid. When the viewer is the job owner we include a light
 * contractor profile preview (company, rating, Google reviews link) so they can
 * evaluate bidders, without exposing the contractor's private contact details.
 */
export function toBidView(bid: BidWithContractor, includeProfile = false) {
  const base = {
    id: bid.id,
    jobId: bid.jobId,
    contractorUserId: bid.contractorUserId,
    amountCents: bid.amount,
    currency: bid.currency,
    message: bid.message,
    status: bid.status,
    createdAt: bid.createdAt,
  };

  if (!includeProfile || !bid.contractor) return base;

  const profile = bid.contractor.contractorProfile;
  return {
    ...base,
    contractor: {
      firstName: bid.contractor.firstName,
      lastName: bid.contractor.lastName,
      companyName: profile?.companyName ?? null,
      ratingAgg: profile?.ratingAgg ?? 0,
      ratingCount: profile?.ratingCount ?? 0,
      googleReviewsUrl: profile?.googleReviewsUrl ?? null,
    },
  };
}
