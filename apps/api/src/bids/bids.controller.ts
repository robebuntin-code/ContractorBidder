import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { BidsService } from './bids.service';
import { CreateBidDto, UpdateBidDto } from './dto/bid.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class BidsController {
  constructor(private readonly bids: BidsService) {}

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('jobs/:jobId/bids')
  create(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CreateBidDto,
  ) {
    return this.bids.create(user, jobId, dto);
  }

  @Get('jobs/:jobId/bids')
  list(@CurrentUser() user: AuthUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.bids.listForJob(user, jobId);
  }

  // PATCH /bids/:id { status: WITHDRAWN }
  @Patch('bids/:id')
  withdraw(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: UpdateBidDto,
  ) {
    return this.bids.withdraw(user, id);
  }

  @Post('bids/:id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bids.accept(user, id);
  }
}
