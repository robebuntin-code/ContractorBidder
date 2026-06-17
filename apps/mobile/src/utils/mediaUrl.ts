import { API_URL } from '../api';

function devMediaBase(): string {
  return `${API_URL.replace(/\/api\/v1\/?$/, '')}/api/v1/dev-media`;
}

function extractMediaKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Local picker URIs must not be rewritten.
  if (/^(file|content|ph|assets-library|data):/i.test(trimmed)) return null;

  const inlineMatch = trimmed.match(/\/dev-media\/([^?#]+)/);
  if (inlineMatch?.[1]) return decodeURIComponent(inlineMatch[1]);

  if (trimmed.startsWith('uploads/')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const pathMatch = parsed.pathname.match(/\/dev-media\/([^?#]+)/);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
  } catch {
    /* not a full URL */
  }

  return null;
}

/** Ensure media URLs use the same reachable host as the API client (fixes stale LAN IPs). */
export function resolveMediaUrl(url: string): string {
  if (!url?.trim()) return url;

  const key = extractMediaKey(url);
  if (!key) return url;

  return `${devMediaBase()}/${key}`;
}
