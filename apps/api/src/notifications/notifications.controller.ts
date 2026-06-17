import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { MarkReadDto } from './dto/mark-read.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.notifications.list(user.userId, unread === 'true');
  }

  @Post('mark-read')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthUser, @Body() dto: MarkReadDto) {
    return this.notifications.markRead(user.userId, dto.ids);
  }

  @Post('clear')
  @HttpCode(200)
  clear(@CurrentUser() user: AuthUser, @Body() dto: MarkReadDto) {
    return this.notifications.clear(user.userId, dto.ids);
  }
}
