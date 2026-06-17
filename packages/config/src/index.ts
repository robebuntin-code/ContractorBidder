/**
 * Shared, framework-agnostic constants used across API and clients.
 * Keep this package free of runtime dependencies so it can be imported
 * by Node, Next.js, and React Native alike.
 */

export const APP_NAME = 'DOJOBID';
export const API_BASE_PATH = '/api/v1';

/** Default feature flags. The API overrides these from env / DB at runtime. */
export const DEFAULT_FEATURE_FLAGS = {
  'payments.enabled': false,
  'messaging.groupVisible': false,
  'profile.requireVerification': false,
  'jobs.maxPhotos': 4,
} as const;

export type FeatureFlagKey = keyof typeof DEFAULT_FEATURE_FLAGS;

/** Coarse location grid size, in kilometers, used to anonymize job locations. */
export const COARSE_GRID_KM = 1;

/** Acceptance fee charged to each side, in cents. */
export const ACCEPTANCE_FEE_CENTS = 100;
