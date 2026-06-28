import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { DevMediaController } from './dev-media.controller';
import { DevMediaService } from './dev-media.service';
import { MediaService } from './media.service';
import { MediaStorageBootstrap } from './media-storage.bootstrap';

@Module({
  controllers: [MediaController, DevMediaController],
  providers: [MediaService, DevMediaService, MediaStorageBootstrap],
  exports: [MediaService, DevMediaService, MediaStorageBootstrap],
})
export class MediaModule {}
