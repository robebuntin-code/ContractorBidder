import { Bid, BidStatus, ContractorProfile, User } from '../generated/prisma/client';

type BidWithContractor = Bid & {
  contractor?: (User & { contractorProfile?: ContractorProfile | null }) | null;
};

export interface BidContractorPreview {
  displayName: string;
  identityRevealed: boolean;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  ratingAgg: number;
  ratingCount: number;
  googleReviewsUrl: string | null;
}

export interface ToBidViewOptions {
  /** Label shown to the homeowner before bid acceptance, e.g. "Contractor #1". */
  anonymousLabel?: string;
  /** When true, include real name/company and Google reviews link. */
  revealIdentity?: boolean;
}

function formatRevealedName(
  contractor: User,
  profile: ContractorProfile | null | undefined,
): string {
  const company = profile?.companyName?.trim();
  if (company) return company;
  const personal = `${contractor.firstName} ${contractor.lastName}`.trim();
  return personal || 'Contractor';
}

function contractorPreview(
  bid: BidWithContractor,
  options: ToBidViewOptions,
): BidContractorPreview | undefined {
  if (!bid.contractor) return undefined;

  const profile = bid.contractor.contractorProfile;
  const revealIdentity = options.revealIdentity ?? bid.status === BidStatus.ACCEPTED;
  const ratingAgg = profile?.ratingAgg ?? 0;
  const ratingCount = profile?.ratingCount ?? 0;

  if (revealIdentity) {
    return {
      displayName: formatRevealedName(bid.contractor, profile),
      identityRevealed: true,
      firstName: bid.contractor.firstName,
      lastName: bid.contractor.lastName,
      companyName: profile?.companyName ?? null,
      ratingAgg,
      ratingCount,
      googleReviewsUrl: profile?.googleReviewsUrl ?? null,
    };
  }

  return {
    displayName: options.anonymousLabel?.trim() || 'Contractor',
    identityRevealed: false,
    firstName: null,
    lastName: null,
    companyName: null,
    ratingAgg,
    ratingCount,
    googleReviewsUrl: null,
  };
}

/**
 * Serialize a bid. When the viewer is the job owner we include a light
 * contractor profile preview (rating, optional identity) so they can evaluate
 * bidders without exposing names until a bid is accepted.
 */
export function toBidView(
  bid: BidWithContractor,
  includeProfile = false,
  options: ToBidViewOptions = {},
) {
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

  return {
    ...base,
    contractor: contractorPreview(bid, options),
  };
}

export interface AcceptBidResponse {
  bid: ReturnType<typeof toBidView>;
  paymentRequired: boolean;
  jobId: string;
  bidId: string;
  homeownerPaymentId?: string | null;
}

export function toAcceptBidResponse(
  bid: BidWithContractor,
  extras: Omit<AcceptBidResponse, 'bid'>,
  options: ToBidViewOptions = { revealIdentity: true },
): AcceptBidResponse {
  return {
    bid: toBidView(bid, !!bid.contractor, options),
    ...extras,
  };
}
