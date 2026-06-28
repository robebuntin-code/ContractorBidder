import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { resolveLocalMediaRoot } from './media-storage.util';

/** On-disk store for dev-media when S3/R2 is not configured. */
@Injectable()
export class DevMediaService {
  constructor(private readonly config: ConfigService) {}

  private get root(): string {
    return resolveLocalMediaRoot(this.config);
  }

  private pathForKey(key: string): string {
    const safe = key.replace(/\.\./g, '');
    return join(this.root, safe);
  }

  async save(key: string, body: Buffer, contentType?: string): Promise<void> {
    const filePath = this.pathForKey(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    if (contentType) {
      await writeFile(`${filePath}.meta`, contentType, 'utf8');
    }
  }

  async load(key: string): Promise<{ body: Buffer; contentType: string }> {
    const filePath = this.pathForKey(key);
    try {
      const body = await readFile(filePath);
      let contentType = 'application/octet-stream';
      try {
        contentType = (await readFile(`${filePath}.meta`, 'utf8')).trim() || contentType;
      } catch {
        /* no sidecar meta */
      }
      return { body, contentType };
    } catch {
      throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'File not found.' });
    }
  }
}
