/**
 * Shared runtime config. Kept separate from api.ts so mediaUrl.ts can import
 * without a circular dependency (api.ts also imports media helpers).
 */
const PRODUCTION_API_URL = 'https://dojobid-api-production.up.railway.app/api/v1';
const PRODUCTION_MEDIA_BASE = 'https://dojobid.com/api/v1/dev-media';
const PRODUCTION_WEB_URL = 'https://dojobid.com';

function isLocalApi(url: string): boolean {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\./.test(url);
}

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || PRODUCTION_API_URL;

/** Public media base — production uses the web app proxy (same as dojobid.com). */
export const MEDIA_BASE_URL =
  process.env.EXPO_PUBLIC_MEDIA_URL?.trim() ||
  (isLocalApi(API_URL)
    ? `${API_URL.replace(/\/api\/v1\/?$/, '')}/api/v1/dev-media`
    : PRODUCTION_MEDIA_BASE);

/** Web app base URL — used for bid acceptance payments on mobile. */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim() || PRODUCTION_WEB_URL;
