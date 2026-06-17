import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/message.dto';

@Controller('jobs/:jobId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CreateMessageDto,
    @Req() req: Request,
  ) {
    return this.messages.create(user, jobId, dto, req);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() req: Request,
  ) {
    return this.messages.listForJob(user, jobId, req);
  }
}
