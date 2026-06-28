import { accessSync, constants, existsSync } from 'fs';
import { join } from 'path';
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

/** Default mount path when a Railway (or similar) volume is attached. */
export const DEFAULT_VOLUME_MEDIA_ROOT = '/data/media';

const EPHEMERAL_ROOT_NAME = '.dev-media';

export type MediaStorageMode = 's3' | 'volume' | 'ephemeral';

export interface MediaStorageStatus {
  mode: MediaStorageMode;
  localRoot: string | null;
  persistent: boolean;
  bucket: string | null;
  publicBaseUrl: string | null;
}

function isProduction(config: ConfigService): boolean {
  if (config.get<string>('NODE_ENV') === 'production') return true;
  if (config.get<string>('RAILWAY_ENVIRONMENT')) return true;
  if (config.get<string>('RAILWAY_PROJECT_ID')) return true;
  return false;
}

/** Resolve the on-disk media directory (S3 mode still uses this only for dev fallback reads). */
export function resolveLocalMediaRoot(config: ConfigService): string {
  const configured = config.get<string>('MEDIA_LOCAL_ROOT')?.trim();
  if (configured) return configured;

  if (existsSync(DEFAULT_VOLUME_MEDIA_ROOT)) {
    return DEFAULT_VOLUME_MEDIA_ROOT;
  }

  return join(process.cwd(), EPHEMERAL_ROOT_NAME);
}

export function isPersistentLocalRoot(localRoot: string): boolean {
  const normalized = localRoot.replace(/\\/g, '/');
  if (normalized.includes(`/${EPHEMERAL_ROOT_NAME}`)) return false;
  if (normalized.endsWith(`/${EPHEMERAL_ROOT_NAME}`)) return false;
  if (normalized === DEFAULT_VOLUME_MEDIA_ROOT) return true;
  if (normalized.startsWith('/data/')) return true;
  // Explicit MEDIA_LOCAL_ROOT outside the app working dir is treated as persistent.
  const cwd = process.cwd().replace(/\\/g, '/');
  return !normalized.startsWith(cwd);
}

export function resolvePublicMediaBaseUrl(config: ConfigService, reqBase?: string): string {
  const configured = config.get<string>('MEDIA_PUBLIC_BASE_URL')?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const webUrl = config.get<string>('PUBLIC_WEB_URL')?.trim();
  if (webUrl) return `${webUrl.replace(/\/$/, '')}/api/v1/dev-media`;

  return reqBase?.replace(/\/$/, '') ?? '';
}

export function getMediaStorageStatus(
  config: ConfigService,
  usesS3: boolean,
  bucket?: string,
): MediaStorageStatus {
  const localRoot = usesS3 ? null : resolveLocalMediaRoot(config);
  const persistent = usesS3 || (localRoot ? isPersistentLocalRoot(localRoot) : false);
  const mode: MediaStorageMode = usesS3
    ? 's3'
    : localRoot && isPersistentLocalRoot(localRoot)
      ? 'volume'
      : 'ephemeral';

  return {
    mode,
    localRoot,
    persistent,
    bucket: bucket ?? null,
    publicBaseUrl: resolvePublicMediaBaseUrl(config) || null,
  };
}

export function requirePersistentMediaInProduction(
  config: ConfigService,
  usesS3: boolean,
): void {
  if (!isProduction(config)) return;

  const status = getMediaStorageStatus(config, usesS3, config.get<string>('MEDIA_S3_BUCKET'));
  if (status.persistent) return;

  throw new ServiceUnavailableException({
    code: 'MEDIA_STORAGE_NOT_CONFIGURED',
    message:
      'Photo uploads require persistent storage. Attach a Railway volume at /data/media ' +
      '(MEDIA_LOCAL_ROOT=/data/media) or configure Cloudflare R2 / S3. ' +
      'See docs/Deploy-Vercel-Railway-Neon.md Step 6c.',
  });
}

export function ensureLocalMediaRootWritable(localRoot: string): void {
  accessSync(localRoot, constants.W_OK);
}
