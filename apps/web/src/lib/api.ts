import type {
  AcceptBidResponse,
  AcceptanceFeeStatus,
  AuthResponse,
  BidCreateDto,
  BidView,
  BidWithContractorView,
  ContractorPublicProfile,
  ContractorPublicReviewView,
  ContractorReviewView,
  JobCoarseView,
  JobCreateDto,
  JobDescriptionSuggestionsDto,
  JobDescriptionSuggestionsResponse,
  JobFullView,
  LoginDto,
  MeView,
  Paginated,
  PaymentSessionResponse,
  PublicUser,
  RegisterDto,
  UpdateMeDto,
} from '@contractor-bidder/types';
import { extractMediaKey, resolveMediaUrl } from './mediaUrl';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:4000/api/v1';

const DEFAULT_TIMEOUT_MS = 10_000;
/** FLUX edits on Replicate often take 30–120s; stay above server AI_PHOTO_EDIT_WAIT_SECONDS. */
const AI_PHOTO_EDIT_TIMEOUT_MS = 150_000;

const ACCESS_KEY = 'cb_access';
const REFRESH_KEY = 'cb_refresh';

export const tokenStore = {
  get access() {
    return typeof window === 'undefined' ? null : localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as AuthResponse;
    tokenStore.set(data);
    return data.accessToken;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function tryRefreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
  retried = false,
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  headers.set('Content-Type', 'application/json');
  const access = tokenStore.access;
  if (access) headers.set('Authorization', `Bearer ${access}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        timeoutMs > DEFAULT_TIMEOUT_MS
          ? 'Image generation is taking longer than expected. Wait a moment and try again.'
          : 'Request timed out. Check your connection and try again.',
      );
    }
    throw new Error('Could not reach the API. Run npm run api and try again.');
  } finally {
    clearTimeout(timeout);
  }

  if (
    res.status === 401 &&
    !retried &&
    path !== '/auth/login' &&
    path !== '/auth/register' &&
    path !== '/auth/refresh'
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) return apiRequest<T>(path, options, true);
    tokenStore.clear();
    throw new Error('Your session expired. Please log in again.');
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  return apiRequest<T>(path, options);
}

export const api = {
  register: (dto: RegisterDto) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(dto) }),

  login: (dto: LoginDto) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(dto) }),

  me: () => request<MeView>('/me'),

  updateMe: (dto: UpdateMeDto) =>
    request<MeView>('/me', { method: 'PATCH', body: JSON.stringify(dto) }),

  createJob: (dto: JobCreateDto) =>
    request<JobFullView>('/jobs', { method: 'POST', body: JSON.stringify(dto) }),

  updateJob: (id: string, dto: JobCreateDto) =>
    request<JobFullView>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),

  getFlags: () =>
    request<{
      paymentsEnabled: boolean;
      messagingGroupVisible: boolean;
      jobsMaxPhotos: number;
      aiJobDescriptionEnabled: boolean;
      aiPhotoEditEnabled: boolean;
    }>('/flags'),

  suggestJobDescription: (dto: JobDescriptionSuggestionsDto) =>
    request<JobDescriptionSuggestionsResponse>('/jobs/description-suggestions', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  editJobPhoto: (sourceKey: string, prompt: string) =>
    request<{ key: string }>('/jobs/photo-edit', {
      method: 'POST',
      body: JSON.stringify({ sourceKey, prompt }),
      timeoutMs: AI_PHOTO_EDIT_TIMEOUT_MS,
    }),

  searchJobs: (params: {
    lat: number;
    lng: number;
    radiusKm: number;
    workType?: string;
  }) => {
    const qs = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      radiusKm: String(params.radiusKm),
      ...(params.workType ? { workType: params.workType } : {}),
    });
    return request<Paginated<JobCoarseView>>(`/jobs/search?${qs.toString()}`);
  },

  myJobs: () => request<JobFullView[]>('/jobs/mine'),

  deleteJob: (id: string) => request<{ deleted: boolean }>(`/jobs/${id}`, { method: 'DELETE' }),

  getJob: (id: string) => request<JobFullView>(`/jobs/${id}`),

  listBids: (jobId: string) => request<BidWithContractor[]>(`/jobs/${jobId}/bids`),

  createBid: (jobId: string, dto: BidCreateDto) =>
    request<BidView>(`/jobs/${jobId}/bids`, { method: 'POST', body: JSON.stringify(dto) }),

  acceptBid: (bidId: string) =>
    request<AcceptBidResponse>(`/bids/${bidId}/accept`, { method: 'POST' }),

  createPaymentSession: (input: {
    jobId: string;
    bidId: string;
    direction: 'HOMEOWNER_ACCEPT_FEE';
  }) =>
    request<PaymentSessionResponse>('/payments/session', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getAcceptanceFeeStatus: (jobId: string) =>
    request<AcceptanceFeeStatus>(`/payments/acceptance-fee?jobId=${encodeURIComponent(jobId)}`),

  getPayment: (paymentId: string) => request<PaymentRecord>(`/payments/${paymentId}`),

  getJobReview: (jobId: string) => request<ContractorReviewView | null>(`/jobs/${jobId}/review`),

  createJobReview: (jobId: string, rating: number, comment?: string) =>
    request<ContractorReviewView>(`/jobs/${jobId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, ...(comment?.trim() ? { comment: comment.trim() } : {}) }),
    }),

  getContractorProfile: (userId: string) =>
    request<ContractorPublicProfile>(`/contractors/${userId}/profile`),

  myContractorProfile: () => request<ContractorProfile>('/contractors/profile'),

  getContractorReviews: (userId: string) =>
    request<ContractorPublicReviewView[]>(`/contractors/${userId}/reviews`),

  withdrawBid: (bidId: string) =>
    request<BidView>(`/bids/${bidId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'WITHDRAWN' }),
    }),

  listMessages: (jobId: string) => request<MessageView[]>(`/jobs/${jobId}/messages`),

  sendMessage: (jobId: string, toUserId: string, body: string, attachments?: string[]) =>
    request<MessageView>(`/jobs/${jobId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        toUserId,
        body,
        ...(attachments?.length ? { attachments } : {}),
      }),
    }),

  signUpload: (contentType: string, fileName: string) =>
    request<SignedUpload>('/media/sign-upload', {
      method: 'POST',
      body: JSON.stringify({ contentType, fileName }),
    }),

  notifications: () => request<NotificationItem[]>('/notifications'),

  unreadNotifications: () => request<NotificationItem[]>('/notifications?unread=true'),

  markNotificationsRead: () =>
    request<{ updated: number }>('/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  clearNotifications: (ids?: string[]) =>
    request<{ deleted: number }>('/notifications/clear', {
      method: 'POST',
      body: JSON.stringify(ids?.length ? { ids } : {}),
    }),

  upsertProfile: (input: {
    companyName?: string;
    logoUrl?: string | null;
    description?: string;
    businessAddress?: string;
    serviceTypes?: string[];
    serviceRadiusKm?: number;
    baseLat?: number;
    baseLng?: number;
    googleReviewsUrl?: string;
  }) => request('/contractors/profile', { method: 'POST', body: JSON.stringify(input) }),

  // --- Admin ---
  adminJobs: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return request<Paginated<JobFullView>>(`/admin/jobs${qs}`);
  },

  adminUsers: (banned?: boolean) => {
    const qs = banned === undefined ? '' : `?banned=${banned}`;
    return request<Paginated<AdminUser>>(`/admin/users${qs}`);
  },

  banUser: (userId: string) =>
    request<{ id: string; isBanned: boolean }>(`/admin/flags/ban-user`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  unbanUser: (userId: string) =>
    request<{ id: string; isBanned: boolean }>(`/admin/flags/unban-user`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};

export interface NotificationItem {
  id: string;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface ContractorProfile {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  companyName: string | null;
  logoUrl: string | null;
  description: string | null;
  businessAddress: string | null;
  serviceTypes: string[];
  serviceRadiusKm: number | null;
  baseLat?: number | null;
  baseLng?: number | null;
  googleReviewsUrl: string | null;
  licenseNumber: string | null;
  ratingAgg: number | null;
  ratingCount: number | null;
}

export type { ContractorPublicProfile, ContractorPublicReviewView, ContractorReviewView, MeView };

export interface PaymentRecord {
  id: string;
  userId: string;
  jobId: string;
  bidId: string | null;
  amountCents: number;
  currency: string;
  direction: string;
  status: string;
  provider: string;
  providerPaymentIntentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageView {
  id: string;
  jobId: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  attachments: string[];
  createdAt: string;
}

export interface SignedUpload {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresInSeconds: number;
}

/** Route dev-media PUTs through the web app (Next rewrite) or configured API host. */
function resolveDevMediaUploadUrl(uploadUrl: string): string {
  if (typeof window === 'undefined') return uploadUrl;

  const keyMatch = uploadUrl.match(/\/dev-media\/([^?]+)/);
  if (!keyMatch?.[1]) return uploadUrl;

  // Same-origin avoids cross-origin PUT/CORS issues in local dev.
  return `${window.location.origin}/api/v1/dev-media/${keyMatch[1]}?dev-upload=true`;
}

export async function uploadToSignedUrl(
  signed: SignedUpload,
  file: File,
  contentType: string,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(resolveDevMediaUploadUrl(signed.uploadUrl), {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
  } catch {
    throw new Error('Could not upload photo. Is the API running on port 4000?');
  }
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status}). Try again or use a smaller image.`);
  }
  // Persist stable object keys — survives host changes and redeploys.
  return signed.key || extractMediaKey(signed.fileUrl) || resolveMediaUrl(signed.fileUrl);
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  createdAt: string;
}

export type BidWithContractor = BidWithContractorView;
