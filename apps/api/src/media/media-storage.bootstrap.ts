import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir } from 'fs/promises';
import { MediaService } from './media.service';
import {
  ensureLocalMediaRootWritable,
  getMediaStorageStatus,
  resolveLocalMediaRoot,
} from './media-storage.util';

/** Ensures production uses persistent media and local storage directories exist. */
@Injectable()
export class MediaStorageBootstrap implements OnModuleInit {
  private readonly logger = new Logger('MediaStorage');

  constructor(
    private readonly config: ConfigService,
    private readonly media: MediaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const usesS3 = this.media.usesS3Storage();
    const status = getMediaStorageStatus(
      this.config,
      usesS3,
      this.config.get<string>('MEDIA_S3_BUCKET'),
    );

    if (!usesS3 && status.localRoot) {
      await mkdir(status.localRoot, { recursive: true });
      ensureLocalMediaRootWritable(status.localRoot);
    }

    if (status.mode === 's3') {
      this.logger.log(`Media storage: S3/R2 bucket "${status.bucket}"`);
    } else if (status.mode === 'volume') {
      this.logger.log(`Media storage: persistent volume at ${status.localRoot}`);
    } else if (this.config.get('RAILWAY_ENVIRONMENT') || this.config.get('NODE_ENV') === 'production') {
      this.logger.error(
        'Media storage is EPHEMERAL — job photos will be lost on redeploy. ' +
          'Complete Step 6c in docs/Deploy-Vercel-Railway-Neon.md before accepting uploads.',
      );
    } else {
      this.logger.warn(
        'Media storage: ephemeral .dev-media (local development only — files are lost on restart).',
      );
    }

    if (!status.publicBaseUrl) {
      this.logger.warn(
        'MEDIA_PUBLIC_BASE_URL (or PUBLIC_WEB_URL) is not set — photo URLs may not resolve for clients.',
      );
    }
  }

  status() {
    return getMediaStorageStatus(
      this.config,
      this.media.usesS3Storage(),
      this.config.get<string>('MEDIA_S3_BUCKET'),
    );
  }
}
