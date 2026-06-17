import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../generated/prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { JobDescriptionAiService } from './job-description-ai.service';
import { JobDescriptionSuggestionsDto } from './dto/description-suggestions.dto';
import { CreateJobDto, JobSearchQueryDto } from './dto/job.dto';

@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly descriptionAi: JobDescriptionAiService,
  ) {}

  // Both homeowners and contractors may post jobs (contractors sub-contract).
  // 20 job posts / minute / user to curb spam.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post()
  @Roles(Role.HOMEOWNER, Role.CONTRACTOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJobDto) {
    return this.jobs.create(user, dto);
  }

  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query() query: JobSearchQueryDto) {
    return this.jobs.search(user, query);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('description-suggestions')
  @Roles(Role.HOMEOWNER, Role.CONTRACTOR)
  descriptionSuggestions(@Body() dto: JobDescriptionSuggestionsDto) {
    return this.descriptionAi.suggest(dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.jobs.findMine(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.findOne(user, id);
  }

  @Patch(':id')
  @Roles(Role.HOMEOWNER, Role.CONTRACTOR)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobs.update(user, id, dto);
  }

  @Post(':id/close')
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.close(user, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.cancel(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.remove(user, id);
  }
}
