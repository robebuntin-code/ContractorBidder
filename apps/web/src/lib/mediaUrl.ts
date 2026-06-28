const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function apiDevMediaBase(): string {
  return `${API_URL.replace(/\/api\/v1\/?$/, '')}/api/v1/dev-media`;
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
 * In the browser, routes through the web app (same-origin Next rewrite → API).
 */
export function resolveMediaUrl(url: string): string {
  if (!url?.trim()) return url;

  const trimmed = url.trim();

  // Direct CDN/R2 public URLs — do not rewrite through dev-media proxy.
  if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('/dev-media/')) {
    return trimmed;
  }

  const key = extractMediaKey(trimmed);
  if (!key) return trimmed;

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/v1/dev-media/${key}`;
  }

  return `${apiDevMediaBase()}/${key}`;
}

/** Normalize photo URLs returned from the API before display. */
export function resolvePhotoUrls(photos: string[] | undefined | null): string[] {
  return (photos ?? []).map((url) => resolveMediaUrl(url)).filter(Boolean);
}
