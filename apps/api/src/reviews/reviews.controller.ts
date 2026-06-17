import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('jobs/:jobId/review')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  getForJob(@CurrentUser() user: AuthUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.reviews.getForJob(user, jobId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(user, jobId, dto);
  }
}
