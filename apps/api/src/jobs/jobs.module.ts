import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { JobsController } from './jobs.controller';
import { JobDescriptionAiService } from './job-description-ai.service';
import { JobPhotoAiService } from './job-photo-ai.service';
import { JobsService } from './jobs.service';
import { MatchingService } from './matching.service';

@Module({
  imports: [MediaModule],
  controllers: [JobsController],
  providers: [JobsService, MatchingService, JobDescriptionAiService, JobPhotoAiService],
  exports: [JobsService],
})
export class JobsModule {}
