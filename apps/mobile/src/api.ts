/**
 * Mobile API client. On a device/emulator, localhost will not reach your dev
 * machine: set EXPO_PUBLIC_API_URL to your LAN IP, e.g.
 *   EXPO_PUBLIC_API_URL="http://192.168.1.20:4000/api/v1"
 * Production:
 *   EXPO_PUBLIC_API_URL="https://dojobid-api-production.up.railway.app/api/v1"
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { API_URL } from './config';
import { extractMediaKey } from './utils/mediaUrl';

export { API_URL };

const ACCESS_KEY = 'cb_access';
const REFRESH_KEY = 'cb_refresh';

/** Thrown when the session cannot be refreshed; UI should redirect to login without showing an error. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

let refreshInFlight: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

export type Role = 'HOMEOWNER' | 'CONTRACTOR' | 'ADMIN';

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  createdAt: string;
}

export interface MeView extends PublicUser {
  phone: string | null;
  homeAddress?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface JobPhotoComparison {
  before: string;
  after: string;
}

export interface JobCoarse {
  id: string;
  title: string;
  description: string;
  workType: string;
  photos: string[];
  photoComparisons: JobPhotoComparison[];
  desiredDatetimeStart: string;
  desiredDatetimeEnd?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency: string;
  status: string;
  createdByUserId: string;
  coarseLat: number;
  coarseLng: number;
  postalCode?: string | null;
  distanceKm?: number;
  createdAt: string;
}

export interface SignedUpload {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresInSeconds: number;
}

export interface ContractorReview {
  id: string;
  jobId: string;
  contractorUserId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export type DevicePlatform = 'IOS' | 'ANDROID' | 'WEB';

export interface JobFull extends JobCoarse {
  addressText: string;
  contactPhone?: string | null;
  preciseLat: number | null;
  preciseLng: number | null;
  acceptedBidId?: string | null;
}

export interface Bid {
  id: string;
  jobId: string;
  contractorUserId: string;
  amountCents: number;
  currency: string;
  message?: string | null;
  status: string;
  createdAt: string;
  contractor?: {
    firstName: string;
    lastName: string;
    companyName: string | null;
    ratingAgg: number;
    ratingCount: number;
    googleReviewsUrl: string | null;
  };
}

export interface AcceptBidResponse {
  bid: Bid;
  paymentRequired: boolean;
  jobId: string;
  bidId: string;
  homeownerPaymentId?: string | null;
}

export interface PaymentSessionResponse {
  paymentId: string;
  clientSecret: string | null;
}

export interface AcceptanceFeeStatus {
  required: boolean;
  status: 'NONE' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  jobId: string;
  bidId?: string | null;
  paymentId?: string | null;
  amountCents: number;
  currency: string;
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

export interface ContractorPublicReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  jobTitle: string;
  reviewerName: string;
}

export interface Message {
  id: string;
  jobId: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  attachments: string[];
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const AI_PHOTO_EDIT_TIMEOUT_MS = 150_000;

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Resolves in-memory token or loads from AsyncStorage (needed for realtime on cold start). */
export async function getAccessTokenAsync(): Promise<string | null> {
  return resolveAccessToken();
}

async function resolveAccessToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  const stored = await AsyncStorage.getItem(ACCESS_KEY);
  if (stored) {
    accessToken = stored;
    return stored;
  }
  return null;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as AuthResponse;
    setAccessToken(data.accessToken);
    await AsyncStorage.multiSet([
      [ACCESS_KEY, data.accessToken],
      [REFRESH_KEY, data.refreshToken],
    ]);
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

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
  retried = false,
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const headers: Record<string, string> = {};
  const token = await resolveAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  Object.assign(headers, (fetchOptions.headers as Record<string, string>) ?? {});
  if (fetchOptions.body != null && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(
        timeoutMs > DEFAULT_TIMEOUT_MS
          ? 'Image generation is taking longer than expected. Wait a moment and try again.'
          : `Server timed out. Is the API running and reachable at ${API_URL}?`,
      );
    }
    throw new Error(`Can't reach the server at ${API_URL}. Is the API running on the same network?`);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    if (
      res.status === 401 &&
      !retried &&
      path !== '/auth/login' &&
      path !== '/auth/register' &&
      path !== '/auth/refresh'
    ) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) return request<T>(path, options, true);
      onSessionExpired?.();
      throw new SessionExpiredError();
    }

    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      /* ignore */
    }
    if (message === 'An unexpected error occurred.') {
      message = `Server error (${res.status}). Check that the API is running and reachable at ${API_URL}.`;
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'HOMEOWNER' | 'CONTRACTOR';
  }) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),

  me: () => request<MeView>('/me'),

  updateMe: (input: {
    phone?: string;
    firstName?: string;
    lastName?: string;
    homeAddress?: string;
  }) => request<MeView>('/me', { method: 'PATCH', body: JSON.stringify(input) }),

  searchJobs: (params: { lat: number; lng: number; radiusKm: number; workType?: string }) => {
    const qs = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      radiusKm: String(params.radiusKm),
      ...(params.workType ? { workType: params.workType } : {}),
    });
    return request<{ items: JobCoarse[]; total: number }>(`/jobs/search?${qs.toString()}`);
  },

  myJobs: () => request<JobFull[]>('/jobs/mine'),

  deleteJob: (id: string) => request<{ deleted: boolean }>(`/jobs/${id}`, { method: 'DELETE' }),

  getJob: (id: string) => request<JobFull>(`/jobs/${id}`),

  createJob: (input: {
    title: string;
    description: string;
    workType: string;
    desiredDatetimeStart: string;
    desiredDatetimeEnd?: string;
    addressText: string;
    contactPhone?: string;
    lat: number;
    lng: number;
    photos?: string[];
    photoComparisons?: JobPhotoComparison[];
    budgetMin?: number;
    budgetMax?: number;
  }) => request<JobFull>('/jobs', { method: 'POST', body: JSON.stringify(input) }),

  updateJob: (
    id: string,
    input: {
      title: string;
      description: string;
      workType: string;
      desiredDatetimeStart: string;
      desiredDatetimeEnd?: string;
      addressText: string;
      contactPhone?: string;
      lat: number;
      lng: number;
    photos?: string[];
    photoComparisons?: JobPhotoComparison[];
    budgetMin?: number;
    budgetMax?: number;
    },
  ) => request<JobFull>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  listBids: (jobId: string) => request<Bid[]>(`/jobs/${jobId}/bids`),

  createBid: (jobId: string, amountCents: number, message?: string) =>
    request<Bid>(`/jobs/${jobId}/bids`, {
      method: 'POST',
      body: JSON.stringify({ amountCents, message }),
    }),

  acceptBid: (bidId: string) => request<AcceptBidResponse>(`/bids/${bidId}/accept`, { method: 'POST' }),

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

  getJobReview: (jobId: string) => request<ContractorReview | null>(`/jobs/${jobId}/review`),

  createJobReview: (jobId: string, rating: number, comment?: string) =>
    request<ContractorReview>(`/jobs/${jobId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, ...(comment?.trim() ? { comment: comment.trim() } : {}) }),
    }),

  listMessages: (jobId: string) => request<Message[]>(`/jobs/${jobId}/messages`),

  sendMessage: (jobId: string, toUserId: string, body: string, attachments?: string[]) =>
    request<Message>(`/jobs/${jobId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        toUserId,
        body,
        ...(attachments?.length ? { attachments } : {}),
      }),
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
  }) => request<ContractorProfile>('/contractors/profile', { method: 'POST', body: JSON.stringify(input) }),

  myContractorProfile: () => request<ContractorProfile>('/contractors/profile'),

  getContractorProfile: (userId: string) =>
    request<ContractorProfile>(`/contractors/${userId}/profile`),

  getContractorReviews: (userId: string) =>
    request<ContractorPublicReview[]>(`/contractors/${userId}/reviews`),

  signUpload: (contentType: string, fileName: string) =>
    request<SignedUpload>('/media/sign-upload', {
      method: 'POST',
      body: JSON.stringify({ contentType, fileName }),
    }),

  registerDevice: (platform: DevicePlatform, token: string) =>
    request('/devices', { method: 'POST', body: JSON.stringify({ platform, token }) }),

  unregisterDevice: (token: string) =>
    request(`/devices/${encodeURIComponent(token)}`, { method: 'DELETE' }),

  getFlags: () =>
    request<{
      paymentsEnabled: boolean;
      messagingGroupVisible: boolean;
      jobsMaxPhotos: number;
      aiJobDescriptionEnabled: boolean;
      aiPhotoEditEnabled: boolean;
    }>('/flags'),

  suggestJobDescription: (input: {
    title: string;
    workType: string;
    description: string;
  }) =>
    request<{ suggestions: { topic: string; prompt: string }[] }>(
      '/jobs/description-suggestions',
      { method: 'POST', body: JSON.stringify(input) },
    ),

  editJobPhoto: (sourceKey: string, prompt: string) =>
    request<{ key: string }>('/jobs/photo-edit', {
      method: 'POST',
      body: JSON.stringify({ sourceKey, prompt }),
      timeoutMs: AI_PHOTO_EDIT_TIMEOUT_MS,
    }),

  geocodeAddress: (address: string) =>
    request<GeocodeResult>('/geocode/forward', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  reverseGeocode: (lat: number, lng: number) =>
    request<GeocodeResult>(`/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`),
};

/**
 * Upload a local file to a pre-signed URL (S3 or local dev-media store).
 * Uses expo-file-system so iOS photo library URIs upload completely (fetch().blob() often sends empty bodies).
 */
export async function uploadToSignedUrl(
  signed: SignedUpload,
  uri: string,
  contentType: string,
): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || (info.size ?? 0) < 512) {
    throw new Error('Could not read the selected photo. Try choosing it again.');
  }

  const response = await FileSystem.uploadAsync(signed.uploadUrl, uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Upload failed (${response.status}). Try a smaller image.`);
  }

  return signed.key || extractMediaKey(signed.fileUrl) || signed.fileUrl;
}
