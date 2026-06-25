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

  const key = extractMediaKey(url);
  if (!key) return url;

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/v1/dev-media/${key}`;
  }

  return `${apiDevMediaBase()}/${key}`;
}
