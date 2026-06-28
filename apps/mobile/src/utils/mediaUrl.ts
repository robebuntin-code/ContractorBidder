import { MEDIA_BASE_URL } from '../config';

function devMediaBase(): string {
  return MEDIA_BASE_URL.replace(/\/$/, '');
}

/** Extract a stable object key from a stored media URL or key path. */
export function extractMediaKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Local picker URIs must not be rewritten.
  if (/^(file|content|ph|assets-library|data|blob):/i.test(trimmed)) return null;

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

function buildDevMediaUrl(key: string): string {
  return `${devMediaBase()}/${key}`;
}

/** Ensure media URLs use the public proxy/CDN path (matches the web app). */
export function resolveMediaUrl(url: string): string {
  if (!url?.trim()) return url;

  const trimmed = url.trim();

  // Direct CDN/R2 public URLs — use unchanged.
  if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('/dev-media/')) {
    return trimmed;
  }

  const key = extractMediaKey(trimmed);
  if (!key) return trimmed;

  return buildDevMediaUrl(key);
}

/** Normalize photo URLs returned from the API before display. */
export function resolvePhotoUrls(photos: string[] | undefined | null): string[] {
  return (photos ?? []).map((url) => resolveMediaUrl(url)).filter(Boolean);
}

/** Normalize before/after scope comparison URLs from the API. */
export function resolvePhotoComparisons(
  comparisons: { before: string; after: string }[] | undefined | null,
): { before: string; after: string }[] {
  return (comparisons ?? []).map((pair) => ({
    before: resolveMediaUrl(pair.before),
    after: resolveMediaUrl(pair.after),
  }));
}

/** Candidate download URLs — try the web proxy first, then the raw input. */
export function mediaDownloadCandidates(url: string): string[] {
  const resolved = resolveMediaUrl(url);
  const candidates = new Set<string>();
  if (resolved.trim()) candidates.add(resolved.trim());
  const trimmed = url.trim();
  if (trimmed && trimmed !== resolved) candidates.add(trimmed);
  return [...candidates];
}
