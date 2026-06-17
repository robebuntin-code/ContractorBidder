import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { AdminJobsQueryDto, AdminUsersQueryDto, BanUserDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('jobs')
  jobs(@Query() query: AdminJobsQueryDto) {
    return this.admin.listJobs(query);
  }

  @Get('users')
  users(@Query() query: AdminUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Post('flags/ban-user')
  @HttpCode(200)
  ban(@CurrentUser() admin: AuthUser, @Body() dto: BanUserDto) {
    return this.admin.setBanned(admin.userId, dto.userId, true);
  }

  @Post('flags/unban-user')
  @HttpCode(200)
  unban(@CurrentUser() admin: AuthUser, @Body() dto: BanUserDto) {
    return this.admin.setBanned(admin.userId, dto.userId, false);
  }
}
