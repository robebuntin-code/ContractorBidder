import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobDescriptionAiService } from './job-description-ai.service';
import { JobsService } from './jobs.service';
import { MatchingService } from './matching.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, MatchingService, JobDescriptionAiService],
  exports: [JobsService],
})
export class JobsModule {}
