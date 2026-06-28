/**
 * Shared API contract types. These mirror the API's DTOs and serialized
 * responses so the web and mobile clients stay in sync. In a later milestone
 * these can be generated from `openapi.yaml` instead of hand-maintained.
 */

// --- Enums ------------------------------------------------------------------

export type Role = 'HOMEOWNER' | 'CONTRACTOR' | 'ADMIN';

export const WORK_TYPES = [
  'electrical',
  'plumbing',
  'landscaping',
  'hauling',
  'carpentry',
  'handyman',
  'other',
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  landscaping: 'Landscaping',
  hauling: 'Hauling',
  carpentry: 'Carpentry',
  handyman: 'Handyman',
  other: 'Other',
};

export function formatWorkType(value: string): string {
  return WORK_TYPE_LABELS[value as WorkType] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export type LocationPrecision = 'PRECISE' | 'COARSE';

export type JobStatus = 'OPEN' | 'UNDER_REVIEW' | 'CLOSED' | 'CANCELLED' | 'AWARDED';

export type BidStatus = 'PENDING' | 'WITHDRAWN' | 'DECLINED' | 'ACCEPTED' | 'EXPIRED';

export type NotificationType =
  | 'JOB_MATCH'
  | 'NEW_BID'
  | 'BID_SUBMITTED'
  | 'BID_ACCEPTED'
  | 'MESSAGE'
  | 'PAYMENT_REQUIRED';

export type PaymentDirection = 'HOMEOWNER_ACCEPT_FEE' | 'CONTRACTOR_ACCEPT_FEE';

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

// --- Auth -------------------------------------------------------------------

export interface RegisterDto {
  email: string;
  password: string;
  role: Exclude<Role, 'ADMIN'>;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}

// --- Users ------------------------------------------------------------------

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  createdAt: string;
}

/** Authenticated user profile from GET/PATCH /me. */
export interface MeView extends PublicUser {
  phone: string | null;
  homeAddress?: string | null;
}

export interface UpdateMeDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  homeAddress?: string;
}

// --- Jobs -------------------------------------------------------------------

export interface JobDescriptionSuggestion {
  topic: string;
  prompt: string;
}

export interface JobDescriptionSuggestionsDto {
  title: string;
  workType: WorkType;
  description: string;
}

export interface JobDescriptionSuggestionsResponse {
  suggestions: JobDescriptionSuggestion[];
}

/** Before/after pair showing planned scope of work for contractors. */
export interface JobPhotoComparison {
  before: string;
  after: string;
}

export interface JobCreateDto {
  title: string;
  description: string;
  workType: WorkType;
  desiredDatetimeStart: string; // ISO
  desiredDatetimeEnd?: string; // ISO
  photos?: string[]; // pre-signed URLs after upload, max 4
  photoComparisons?: JobPhotoComparison[];
  addressText: string;
  contactPhone?: string;
  lat: number;
  lng: number;
  locationPrecision?: LocationPrecision;
  budgetMin?: number; // cents
  budgetMax?: number; // cents
  currency?: 'USD';
}

/** Full job payload for PATCH — same shape as create; only allowed when no bids exist. */
export type JobUpdateDto = JobCreateDto;

export interface JobSearchQuery {
  workType?: WorkType;
  lat: number;
  lng: number;
  radiusKm: number;
  createdByRole?: Exclude<Role, 'ADMIN'>;
  onlyOpen?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * Job as serialized to a NON-owner (e.g. a browsing contractor). Precise
 * address and coordinates are intentionally omitted until bid acceptance.
 */
export interface JobCoarseView {
  id: string;
  title: string;
  description: string;
  workType: WorkType;
  desiredDatetimeStart: string;
  desiredDatetimeEnd?: string | null;
  photos: string[];
  /** Before/after scope visualization pairs for contractors. */
  photoComparisons: JobPhotoComparison[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency: string;
  status: JobStatus;
  createdByRole: Role;
  /** Needed so contractors can message the job owner before bidding. */
  createdByUserId: string;
  coarseLat: number;
  coarseLng: number;
  /** ZIP code only — full address withheld until bid acceptance. */
  postalCode?: string | null;
  distanceKm?: number;
  createdAt: string;
}

/** Job as serialized to the owner or accepted contractor (full detail). */
export interface JobFullView extends JobCoarseView {
  addressText: string;
  contactPhone?: string | null;
  preciseLat: number | null;
  preciseLng: number | null;
  acceptedBidId?: string | null;
}

// --- Bids -------------------------------------------------------------------

export interface BidCreateDto {
  amountCents: number;
  currency?: 'USD';
  message?: string;
}

export interface BidView {
  id: string;
  jobId: string;
  contractorUserId: string;
  amountCents: number;
  currency: string;
  message?: string | null;
  status: BidStatus;
  createdAt: string;
}

/** Contractor preview on a bid — identity masked until the bid is accepted. */
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

export type BidWithContractorView = BidView & {
  contractor?: BidContractorPreview;
};

/** Label for a bid's contractor — masked until accepted; works with legacy API responses too. */
export function formatBidContractorDisplayName(
  contractor: Partial<BidContractorPreview> | undefined,
  options: { anonymousLabel: string; bidStatus?: BidStatus },
): string {
  if (!contractor) return options.anonymousLabel;

  const displayName = contractor.displayName?.trim();
  if (displayName) return displayName;

  const identityRevealed =
    contractor.identityRevealed === true || options.bidStatus === 'ACCEPTED';

  if (identityRevealed) {
    const company = contractor.companyName?.trim();
    if (company) return company;
    const personal = [contractor.firstName, contractor.lastName]
      .filter((part): part is string => !!part?.trim())
      .join(' ')
      .trim();
    if (personal) return personal;
    return 'Contractor';
  }

  return options.anonymousLabel;
}

/** Whether the contractor's public identity (name, Google link) may be shown. */
export function isBidContractorIdentityRevealed(
  contractor: Partial<BidContractorPreview> | undefined,
  bidStatus?: BidStatus,
): boolean {
  if (!contractor) return false;
  if (contractor.identityRevealed === true) return true;
  return bidStatus === 'ACCEPTED';
}

/** Returned from POST /bids/:id/accept when payments may be required. */
export interface AcceptBidResponse {
  bid: BidWithContractorView;
  paymentRequired: boolean;
  jobId: string;
  bidId: string;
  homeownerPaymentId?: string | null;
}

export interface PaymentSessionResponse {
  paymentId: string;
  clientSecret: string | null;
}

export type AcceptanceFeeStatusValue = 'NONE' | PaymentStatus;

export interface AcceptanceFeeStatus {
  required: boolean;
  status: AcceptanceFeeStatusValue;
  jobId: string;
  bidId?: string | null;
  paymentId?: string | null;
  amountCents: number;
  currency: string;
}

// --- Generic ----------------------------------------------------------------

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  correlationId?: string;
}

// --- Reviews ----------------------------------------------------------------

/** Contractor review left by a homeowner for an awarded job. */
export interface ContractorReviewView {
  id: string;
  jobId: string;
  contractorUserId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface CreateReviewDto {
  rating: number;
  comment?: string;
}

/** Public review shown on a contractor profile. */
export interface ContractorPublicReviewView {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  jobTitle: string;
  reviewerName: string;
}

// --- Contractors ------------------------------------------------------------

/** Public contractor profile (GET /contractors/:userId/profile). */
export interface ContractorPublicProfile {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  companyName: string | null;
  logoUrl: string | null;
  description: string | null;
  businessAddress: string | null;
  serviceTypes: string[];
  serviceRadiusKm: number;
  googleReviewsUrl: string | null;
  licenseNumber: string | null;
  ratingAgg: number;
  ratingCount: number;
}
