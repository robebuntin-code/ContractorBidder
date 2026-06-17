import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

/** Public contractor reviews (no auth required). */
@Controller('contractors/:userId/reviews')
export class ContractorReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.reviews.listForContractorPublic(userId);
  }
}
