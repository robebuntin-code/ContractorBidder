const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Ensure dev-media URLs use the configured API host. */
export function resolveMediaUrl(url: string): string {
  if (!url?.trim()) return url;

  const keyMatch = url.match(/\/dev-media\/(.+?)(?:\?|$)/);
  if (!keyMatch?.[1]) return url;

  const apiOrigin = API_URL.replace(/\/api\/v1\/?$/, '');
  return `${apiOrigin}/api/v1/dev-media/${keyMatch[1]}`;
}
