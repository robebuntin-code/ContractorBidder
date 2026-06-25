import * as FileSystem from 'expo-file-system/legacy';
import { mediaDownloadCandidates } from './mediaUrl';

const MIN_BYTES = 512;

function cachePathFor(remoteUrl: string): string {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('No cache directory');
  const extMatch = remoteUrl.match(/\.(jpe?g|png|webp|gif|heic)(\?|#|$)/i);
  const ext = extMatch?.[1]?.toLowerCase().replace('jpeg', 'jpg') ?? 'bin';
  const slug = remoteUrl.replace(/[^a-zA-Z0-9]+/g, '_').slice(-160);
  return `${cacheDir}media_${slug}.${ext}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('Base64 encoder unavailable');
  }
  return globalThis.btoa(binary);
}

async function writeCachedFile(localPath: string, body: ArrayBuffer): Promise<string> {
  if (body.byteLength < MIN_BYTES) {
    throw new Error('Downloaded file is too small');
  }
  await FileSystem.writeAsStringAsync(localPath, arrayBufferToBase64(body), {
    encoding: FileSystem.EncodingType.Base64,
  });
  const saved = await FileSystem.getInfoAsync(localPath);
  if (!saved.exists) throw new Error('Cached file missing');
  return saved.uri ?? localPath;
}

async function downloadToCache(remoteUrl: string): Promise<string> {
  const localPath = cachePathFor(remoteUrl);
  const existing = await FileSystem.getInfoAsync(localPath);
  if (existing.exists && (existing.size ?? 0) >= MIN_BYTES) {
    return existing.uri ?? localPath;
  }

  const result = await FileSystem.downloadAsync(remoteUrl, localPath);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Download failed (${result.status})`);
  }

  const saved = await FileSystem.getInfoAsync(result.uri);
  if (!saved.exists) throw new Error('Download missing on disk');
  if ((saved.size ?? 0) > 0 && (saved.size ?? 0) < MIN_BYTES) {
    throw new Error('Photo file is corrupt — re-upload the image');
  }

  return result.uri;
}

async function fetchToCache(remoteUrl: string): Promise<string> {
  const localPath = cachePathFor(remoteUrl);
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }
  return writeCachedFile(localPath, await response.arrayBuffer());
}

/** Download remote media to a local file:// URI for reliable Image display on iOS. */
export async function cacheRemoteMedia(remoteUrl: string): Promise<string> {
  const candidates = mediaDownloadCandidates(remoteUrl);
  if (!candidates.length) throw new Error('Missing media URL');

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await downloadToCache(candidate);
    } catch (error) {
      lastError = error;
      try {
        return await fetchToCache(candidate);
      } catch (fetchError) {
        lastError = fetchError;
      }
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Could not load photo');
}
