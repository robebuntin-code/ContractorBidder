import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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
        : await getSignedUrl(
            this.s3,
            new GetObjectCommand({ Bucket: this.bucket, Key: key }),
            { expiresIn: 3600 },
          );
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

  /** Rewrite a stored media URL so phones/other clients can fetch it (fixes localhost URLs). */
  resolvePublicUrl(storedUrl: string, req?: Request): string {
    if (!storedUrl?.trim()) return storedUrl;
    const key = this.extractMediaKey(storedUrl);
    if (!key) return storedUrl;

    if (this.s3 && this.bucket && this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }

    return `${this.getDevMediaBase(req)}/${key}`;
  }

  private extractMediaKey(storedUrl: string): string | null {
    try {
      const parsed = new URL(storedUrl);
      const match = parsed.pathname.match(/\/dev-media\/(.+)$/);
      if (match?.[1]) return decodeURIComponent(match[1]);
    } catch {
      /* not a full URL */
    }
    if (storedUrl.startsWith('uploads/')) return storedUrl;
    return null;
  }
}
