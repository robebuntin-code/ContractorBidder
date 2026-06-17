import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ContractorReviewsController } from './contractor-reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ReviewsController, ContractorReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
