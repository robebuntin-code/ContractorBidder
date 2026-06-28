import {
  Controller,
  Get,
  NotFoundException,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { DevMediaService } from './dev-media.service';
import { MediaService } from './media.service';

/**
 * Serves uploaded files at /api/v1/dev-media/...
 * - Local dev: filesystem via DevMediaService
 * - Production: proxies reads from S3/R2 when MEDIA_S3_BUCKET is set
 */
@Controller('dev-media')
export class DevMediaController {
  constructor(
    private readonly devMedia: DevMediaService,
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  private assertLocalUploadMode(): void {
    if (this.config.get<string>('MEDIA_S3_BUCKET')) {
      throw new NotFoundException();
    }
  }

  private keyFromRequest(req: Request): string {
    const match = req.originalUrl.match(/\/dev-media\/([^?]+)/);
    if (!match?.[1]) {
      throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Invalid path.' });
    }
    return decodeURIComponent(match[1]);
  }

  @Put('*')
  async upload(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.assertLocalUploadMode();
    const key = this.keyFromRequest(req);
    const body = req.body as Buffer | undefined;
    if (!body?.length) {
      res.status(400).json({ message: 'Empty upload body.' });
      return;
    }
    const contentType = req.header('content-type') ?? 'application/octet-stream';
    await this.devMedia.save(key, body, contentType);
    res.status(204).end();
  }

  @Get('*')
  async download(@Req() req: Request, @Res() res: Response): Promise<void> {
    const key = this.keyFromRequest(req);
    const { body, contentType } = this.media.usesS3Storage()
      ? await this.media.loadObject(key)
      : await this.devMedia.load(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(body);
  }
}
