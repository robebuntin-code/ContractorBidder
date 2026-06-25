import { Controller, Get } from '@nestjs/common';
import { FeatureFlagsService } from './common/feature-flags.service';

@Controller()
export class AppController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
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
