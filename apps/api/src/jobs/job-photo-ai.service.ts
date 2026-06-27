import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { FeatureFlagsService } from '../common/feature-flags.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { DevMediaService } from '../media/dev-media.service';
import { MediaService } from '../media/media.service';
import type { JobPhotoEditDto } from './dto/photo-edit.dto';

export interface JobPhotoEditResult {
  key: string;
}

@Injectable()
export class JobPhotoAiService {
  private readonly logger = new Logger('JobPhotoAi');

  constructor(
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly media: MediaService,
    private readonly devMedia: DevMediaService,
  ) {}

  async edit(user: AuthUser, dto: JobPhotoEditDto, req?: Request): Promise<JobPhotoEditResult> {
    if (!this.flags.flags.aiPhotoEditEnabled) {
      throw new ServiceUnavailableException({
        code: 'AI_PHOTO_EDIT_DISABLED',
        message: 'AI photo editing is not enabled.',
      });
    }

    const token = this.config.get<string>('REPLICATE_API_TOKEN')?.trim();
    if (!token) {
      throw new ServiceUnavailableException({
        code: 'AI_PHOTO_EDIT_NOT_CONFIGURED',
        message: 'AI photo editing is not configured on the server.',
      });
    }

    const sourceKey = this.media.normalizeStoredUrl(dto.sourceKey);
    this.assertOwnedSourceKey(user.userId, sourceKey);

    const inputImage = await this.resolveInputImage(sourceKey, req);
    const model =
      this.config.get<string>('AI_PHOTO_EDIT_MODEL')?.trim() ||
      'black-forest-labs/flux-kontext-dev';

    const outputUrl = await this.runReplicate(model, token, {
      prompt: dto.prompt.trim(),
      input_image: inputImage,
      aspect_ratio: 'match_input_image',
      output_format: 'jpg',
      output_quality: 85,
    });

    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      throw new ServiceUnavailableException({
        code: 'AI_PHOTO_EDIT_DOWNLOAD_FAILED',
        message: 'Could not retrieve the edited image.',
      });
    }

    const body = Buffer.from(await imageRes.arrayBuffer());
    if (body.length < 512) {
      throw new BadRequestException({
        code: 'AI_PHOTO_EDIT_EMPTY',
        message: 'The AI returned an empty image. Try a different prompt.',
      });
    }

    const key = `uploads/${user.userId}/${randomUUID()}.jpg`;
    await this.devMedia.save(key, body, 'image/jpeg');

    return { key };
  }

  private assertOwnedSourceKey(userId: string, sourceKey: string): void {
    const expectedPrefix = `uploads/${userId}/`;
    if (!sourceKey.startsWith(expectedPrefix)) {
      throw new ForbiddenException({
        code: 'NOT_YOUR_UPLOAD',
        message: 'You can only edit photos you uploaded.',
      });
    }
  }

  /** Load source bytes and send inline to Replicate (avoids public URL fetch failures). */
  private async resolveInputImage(sourceKey: string, req?: Request): Promise<string> {
    let body: Buffer;
    let contentType: string;

    if (this.config.get<string>('MEDIA_S3_BUCKET')) {
      const url = this.publicMediaUrl(sourceKey, req);
      const res = await fetch(url);
      if (!res.ok) {
        throw new ServiceUnavailableException({
          code: 'AI_PHOTO_EDIT_SOURCE_MISSING',
          message:
            'Could not find the uploaded photo. Remove it, upload again, then try Generate preview.',
        });
      }
      body = Buffer.from(await res.arrayBuffer());
      contentType = res.headers.get('content-type') ?? 'image/jpeg';
    } else {
      try {
        const loaded = await this.devMedia.load(sourceKey);
        body = loaded.body;
        contentType = loaded.contentType;
      } catch {
        throw new ServiceUnavailableException({
          code: 'AI_PHOTO_EDIT_SOURCE_MISSING',
          message:
            'Could not find the uploaded photo. Remove it, upload again, then try Generate preview.',
        });
      }
    }

    if (body.length < 64) {
      throw new BadRequestException({
        code: 'AI_PHOTO_EDIT_SOURCE_EMPTY',
        message: 'The uploaded photo appears empty. Try uploading again.',
      });
    }

    const mime = contentType.startsWith('image/') ? contentType.split(';')[0].trim() : 'image/jpeg';
    return `data:${mime};base64,${body.toString('base64')}`;
  }

  /** Public HTTPS URL for remote fetchers (S3 mode). */
  private publicMediaUrl(sourceKey: string, req?: Request): string {
    const configured = this.config.get<string>('MEDIA_PUBLIC_BASE_URL')?.trim();
    if (configured) {
      return `${configured.replace(/\/$/, '')}/${sourceKey}`;
    }
    const resolved = this.media.resolvePublicUrl(sourceKey, req);
    if (!/^https:\/\//i.test(resolved)) {
      throw new ServiceUnavailableException({
        code: 'AI_PHOTO_EDIT_NO_PUBLIC_URL',
        message:
          'Set MEDIA_PUBLIC_BASE_URL (e.g. https://dojobid.com/api/v1/dev-media) so the AI can read uploaded photos.',
      });
    }
    return resolved;
  }

  private async runReplicate(
    model: string,
    token: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const totalWaitSeconds = Number(this.config.get('AI_PHOTO_EDIT_WAIT_SECONDS') ?? 120);
    const syncWaitSeconds = Math.min(60, Math.max(1, totalWaitSeconds));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), totalWaitSeconds * 1000);

    try {
      const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: `wait=${syncWaitSeconds}`,
        },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });

      let payload = (await res.json()) as ReplicatePredictionPayload;

      if (!res.ok) {
        this.logger.warn(`Replicate error ${res.status}: ${JSON.stringify(payload)}`);
        throw new ServiceUnavailableException({
          code: 'AI_PHOTO_EDIT_FAILED',
          message: this.replicateErrorMessage(payload),
        });
      }

      payload = await this.waitForReplicatePrediction(payload, token, controller.signal);

      const output = payload.output;
      const url = Array.isArray(output) ? output[0] : output;
      if (!url || typeof url !== 'string') {
        throw new ServiceUnavailableException({
          code: 'AI_PHOTO_EDIT_NO_OUTPUT',
          message: 'AI photo edit returned no image.',
        });
      }

      return url;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException({
          code: 'AI_PHOTO_EDIT_TIMEOUT',
          message: 'AI photo edit timed out. Try a simpler prompt.',
        });
      }
      this.logger.error('Replicate request failed', err as Error);
      throw new ServiceUnavailableException({
        code: 'AI_PHOTO_EDIT_FAILED',
        message: 'AI photo edit failed. Try again in a moment.',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async waitForReplicatePrediction(
    initial: ReplicatePredictionPayload,
    token: string,
    signal: AbortSignal,
  ): Promise<ReplicatePredictionPayload> {
    let payload = initial;
    const pollUrl =
      payload.urls?.get ??
      (payload.id ? `https://api.replicate.com/v1/predictions/${payload.id}` : null);

    while (payload.status === 'starting' || payload.status === 'processing') {
      if (!pollUrl) {
        throw new ServiceUnavailableException({
          code: 'AI_PHOTO_EDIT_FAILED',
          message: payload.error || 'AI photo edit did not complete. Try again.',
        });
      }

      await this.sleep(1500, signal);

      const res = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      payload = (await res.json()) as ReplicatePredictionPayload;

      if (!res.ok) {
        this.logger.warn(`Replicate poll error ${res.status}: ${JSON.stringify(payload)}`);
        throw new ServiceUnavailableException({
          code: 'AI_PHOTO_EDIT_FAILED',
          message: payload.detail || payload.error || 'AI photo edit failed. Try again.',
        });
      }
    }

    if (payload.status === 'failed' || payload.status === 'canceled') {
      throw new ServiceUnavailableException({
        code: 'AI_PHOTO_EDIT_FAILED',
        message: this.replicateErrorMessage(payload),
      });
    }

    if (payload.status !== 'succeeded') {
      throw new ServiceUnavailableException({
        code: 'AI_PHOTO_EDIT_FAILED',
        message: payload.error || 'AI photo edit did not complete. Try again.',
      });
    }

    return payload;
  }

  private replicateErrorMessage(payload: ReplicatePredictionPayload): string {
    const raw = payload.detail || payload.error || '';
    if (/404 client error/i.test(raw) || /not found for url/i.test(raw)) {
      return 'Could not find the uploaded photo. Remove it, upload again, then try Generate preview.';
    }
    return raw || 'AI photo edit did not complete. Try again.';
  }

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const timer = setTimeout(resolve, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

interface ReplicatePredictionPayload {
  id?: string;
  error?: string;
  detail?: string;
  status?: string;
  output?: string | string[] | null;
  urls?: { get?: string };
}
