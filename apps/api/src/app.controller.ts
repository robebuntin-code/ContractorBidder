import { Controller, Get } from '@nestjs/common';
import { FeatureFlagsService } from './common/feature-flags.service';
import { MediaStorageBootstrap } from './media/media-storage.bootstrap';

@Controller()
export class AppController {
  constructor(
    private readonly flags: FeatureFlagsService,
    private readonly mediaStorage: MediaStorageBootstrap,
  ) {}

  @Get('health')
  health() {
    const media = this.mediaStorage.status();
    return {
      status: 'ok',
      time: new Date().toISOString(),
      media: {
        mode: media.mode,
        persistent: media.persistent,
      },
    };
  }

  @Get('flags')
  publicFlags() {
    const f = this.flags.flags;
    return {
      paymentsEnabled: f.paymentsEnabled,
      messagingGroupVisible: f.messagingGroupVisible,
      jobsMaxPhotos: f.jobsMaxPhotos,
      aiJobDescriptionEnabled: f.aiJobDescriptionEnabled,
      aiPhotoEditEnabled: f.aiPhotoEditEnabled,
    };
  }
}
