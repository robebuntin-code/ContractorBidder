import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { DevMediaController } from './dev-media.controller';
import { DevMediaService } from './dev-media.service';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController, DevMediaController],
  providers: [MediaService, DevMediaService],
  exports: [MediaService, DevMediaService],
})
export class MediaModule {}
