import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ContractorsService } from './contractors.service';
import { UpsertContractorProfileDto } from './dto/contractor-profile.dto';

@Controller('contractors')
export class ContractorsController {
  constructor(private readonly contractors: ContractorsService) {}

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertContractorProfileDto,
    @Req() req: Request,
  ) {
    return this.contractors.upsertMine(user, dto, req);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertContractorProfileDto,
    @Req() req: Request,
  ) {
    return this.contractors.upsertMine(user, dto, req);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getMine(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.contractors.getMine(user, req);
  }

  // Public: anyone (incl. unauthenticated browsing) can view a contractor's public profile.
  @Get(':userId/profile')
  getPublic(@Param('userId', ParseUUIDPipe) userId: string, @Req() req: Request) {
    return this.contractors.getPublic(userId, req);
  }
}
