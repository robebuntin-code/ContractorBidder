import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SignUploadDto } from './dto/sign-upload.dto';

export interface SignedUpload {
  /** PUT here with the exact Content-Type to upload the object. */
  uploadUrl: string;
  /** Stable URL/key to persist on the job once the upload succeeds. */
  fileUrl: string;
  /** Object key within the bucket. */
  key: string;
  expiresInSeconds: number;
}

const UPLOAD_TTL_SECONDS = 300;

/**
 * Issues short-lived signed upload URLs. Uses S3 when `MEDIA_S3_BUCKET` is set,
 * otherwise falls back to a dev provider that returns a local placeholder URL so
 * the flow is exercisable without cloud credentials. EXIF GPS stripping and
 * image dimension/type validation happen out-of-band (e.g. a post-upload Lambda
 * or on-read transform) — see SECURITY notes in the README.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger('Media');
  private readonly s3?: S3Client;
  private readonly bucket?: string;
  private readonly publicBaseUrl?: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('MEDIA_S3_BUCKET') || undefined;
    this.publicBaseUrl = this.config.get<string>('MEDIA_PUBLIC_BASE_URL') || undefined;
    if (this.bucket) {
      this.s3 = new S3Client({
        region: this.config.get<string>('AWS_REGION') ?? 'us-east-1',
        endpoint: this.config.get<string>('MEDIA_S3_ENDPOINT') || undefined,
        forcePathStyle: !!this.config.get<string>('MEDIA_S3_ENDPOINT'),
      });
    }
  }

  async signUpload(userId: string, dto: SignUploadDto, req?: Request): Promise<SignedUpload> {
    const ext = dto.fileName.includes('.') ? dto.fileName.split('.').pop() : 'bin';
    const key = `uploads/${userId}/${randomUUID()}.${ext}`;

    if (this.s3 && this.bucket) {
      const uploadUrl = await getSignedUrl(
        this.s3,
        new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: dto.contentType }),
        { expiresIn: UPLOAD_TTL_SECONDS },
      );
      const fileUrl = this.publicBaseUrl
        ? `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`
        : key;
      return { uploadUrl, fileUrl, key, expiresInSeconds: UPLOAD_TTL_SECONDS };
    }

    // Dev fallback: upload to local dev-media routes (see DevMediaController).
    this.logger.warn('MEDIA_S3_BUCKET not set — using local dev-media storage.');
    const uploadBase = this.getDevMediaUploadBase(req);
    const fileBase = this.getDevMediaBase(req);
    return {
      uploadUrl: `${uploadBase}/${key}?dev-upload=true`,
      fileUrl: `${fileBase}/${key}`,
      key,
      expiresInSeconds: UPLOAD_TTL_SECONDS,
    };
  }

  /** Base URL clients PUT uploads to — always matches the API host that issued the signed URL. */
  getDevMediaUploadBase(req?: Request): string {
    const port = this.config.get<string>('API_PORT') ?? '4000';
    const host = req?.get('host') ?? `localhost:${port}`;
    const proto = req?.get('x-forwarded-proto') ?? req?.protocol ?? 'http';
    return `${proto}://${host}/api/v1/dev-media`;
  }

  /** Public base URL for dev-media files, reachable from mobile devices on the LAN. */
  getDevMediaBase(req?: Request): string {
    if (this.publicBaseUrl) return this.publicBaseUrl.replace(/\/$/, '');
    const port = this.config.get<string>('API_PORT') ?? '4000';
    const host = req?.get('host') ?? `localhost:${port}`;
    const proto = req?.get('x-forwarded-proto') ?? req?.protocol ?? 'http';
    return `${proto}://${host}/api/v1/dev-media`;
  }

  /** Stable value to persist after upload (key or public URL — never a short-lived signed URL). */
  normalizeStoredUrl(storedUrl: string): string {
    if (!storedUrl?.trim()) return storedUrl;
    const key = this.extractMediaKey(storedUrl);
    return key ?? storedUrl.trim();
  }

  usesS3Storage(): boolean {
    return !!(this.s3 && this.bucket);
  }

  /** Read an uploaded object from S3/R2 (production media store). */
  async loadObject(key: string): Promise<{ body: Buffer; contentType: string }> {
    if (!this.s3 || !this.bucket) {
      throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Object storage not configured.' });
    }

    try {
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) {
        throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'File not found.' });
      }
      const body = Buffer.from(await result.Body.transformToByteArray());
      return {
        body,
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (name === 'NoSuchKey' || name === 'NotFound') {
        throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'File not found.' });
      }
      throw err;
    }
  }

  /** Rewrite a stored media URL so phones/other clients can fetch it (fixes localhost URLs). */
  resolvePublicUrl(storedUrl: string, req?: Request): string {
    if (!storedUrl?.trim()) return storedUrl;
    const key = this.extractMediaKey(storedUrl);
    if (!key) return storedUrl;

    if (this.s3 && this.bucket) {
      if (this.publicBaseUrl) {
        return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
      }
      // S3 without a public CDN — serve via dev-media-style path resolved on read.
      return `${this.getDevMediaBase(req)}/${key}`;
    }

    return `${this.getDevMediaBase(req)}/${key}`;
  }

  private extractMediaKey(storedUrl: string): string | null {
    if (storedUrl.startsWith('uploads/')) return storedUrl;

    try {
      const parsed = new URL(storedUrl);
      const devMediaMatch = parsed.pathname.match(/\/dev-media\/(.+)$/);
      if (devMediaMatch?.[1]) return decodeURIComponent(devMediaMatch[1]);

      const uploadsMatch = parsed.pathname.match(/\/(uploads\/[^/].*)$/);
      if (uploadsMatch?.[1]) return decodeURIComponent(uploadsMatch[1]);
    } catch {
      /* not a full URL */
    }

    return null;
  }
}
