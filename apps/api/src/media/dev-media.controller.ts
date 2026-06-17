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

/**
 * Serves uploaded files in local dev when S3 is not configured.
 * Routes are version-neutral so URLs stay at /api/v1/dev-media/...
 */
@Controller('dev-media')
export class DevMediaController {
  constructor(
    private readonly devMedia: DevMediaService,
    private readonly config: ConfigService,
  ) {}

  private assertDevMode(): void {
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
    this.assertDevMode();
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
    this.assertDevMode();
    const key = this.keyFromRequest(req);
    const { body, contentType } = await this.devMedia.load(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(body);
  }
}
