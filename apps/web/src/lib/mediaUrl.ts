const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function apiOrigin(): string {
  return API_URL.replace(/\/api\/v1\/?$/, '');
}

function apiDevMediaBase(): string {
  return `${apiOrigin()}/api/v1/dev-media`;
}

function webDevMediaBase(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/v1/dev-media`;
  }
  return apiDevMediaBase();
}

/** Preferred public base for dev-media reads (API host — avoids brittle Vercel rewrites). */
export function publicDevMediaBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL?.trim()) {
    return apiDevMediaBase();
  }
  return webDevMediaBase();
}

/** Extract a stable object key from a stored media URL or key path. */
export function extractMediaKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^(blob|data):/i.test(trimmed)) return null;

  const inlineMatch = trimmed.match(/\/dev-media\/([^?#]+)/);
  if (inlineMatch?.[1]) return decodeURIComponent(inlineMatch[1]);

  if (trimmed.startsWith('uploads/')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const devMediaMatch = parsed.pathname.match(/\/dev-media\/([^?#]+)/);
    if (devMediaMatch?.[1]) return decodeURIComponent(devMediaMatch[1]);

    const uploadsMatch = parsed.pathname.match(/\/(uploads\/[^/].*)$/);
    if (uploadsMatch?.[1]) return decodeURIComponent(uploadsMatch[1]);
  } catch {
    /* not a full URL */
  }

  return null;
}

/**
 * Resolve job/profile media for display.
 * Prefer the API dev-media host; fall back to same-origin proxy in local dev.
 */
export function resolveMediaUrl(url: string): string {
  if (!url?.trim()) return url;

  const trimmed = url.trim();

  // Direct CDN/R2 public URLs — use unchanged.
  if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('/dev-media/')) {
    return trimmed;
  }

  const key = extractMediaKey(trimmed);
  if (!key) return trimmed;

  return `${publicDevMediaBase()}/${key}`;
}

/** Candidate download URLs — try API host first, then web proxy, then raw input. */
export function mediaDownloadCandidates(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return [];

  const key = extractMediaKey(trimmed);
  const candidates = new Set<string>();

  if (key) {
    candidates.add(`${publicDevMediaBase()}/${key}`);
    if (typeof window !== 'undefined') {
      candidates.add(`${window.location.origin}/api/v1/dev-media/${key}`);
    }
    candidates.add(`${apiDevMediaBase()}/${key}`);
  }

  const resolved = resolveMediaUrl(trimmed);
  if (resolved) candidates.add(resolved);
  if (trimmed.startsWith('http')) candidates.add(trimmed);

  return [...candidates];
}

/** Normalize photo URLs returned from the API before display. */
export function resolvePhotoUrls(photos: string[] | undefined | null): string[] {
  return (photos ?? []).map((url) => resolveMediaUrl(url)).filter(Boolean);
}
