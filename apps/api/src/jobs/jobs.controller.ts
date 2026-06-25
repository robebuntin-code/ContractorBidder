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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../generated/prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { JobDescriptionAiService } from './job-description-ai.service';
import { JobPhotoAiService } from './job-photo-ai.service';
import { JobDescriptionSuggestionsDto } from './dto/description-suggestions.dto';
import { JobPhotoEditDto } from './dto/photo-edit.dto';
import { CreateJobDto, JobSearchQueryDto } from './dto/job.dto';

@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly descriptionAi: JobDescriptionAiService,
    private readonly photoAi: JobPhotoAiService,
  ) {}

  // Both homeowners and contractors may post jobs (contractors sub-contract).
  // 20 job posts / minute / user to curb spam.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post()
  @Roles(Role.HOMEOWNER, Role.CONTRACTOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJobDto, @Req() req: Request) {
    return this.jobs.create(user, dto, req);
  }

  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query() query: JobSearchQueryDto, @Req() req: Request) {
    return this.jobs.search(user, query, req);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('description-suggestions')
  @Roles(Role.HOMEOWNER, Role.CONTRACTOR)
  descriptionSuggestions(@Body() dto: JobDescriptionSuggestionsDto) {
    return this.descriptionAi.suggest(dto);
  }

  /** Instruction-based photo edit (FLUX Kontext). Expensive — strict rate limit. */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('photo-edit')
  @Roles(Role.HOMEOWNER, Role.CONTRACTOR)
  photoEdit(@CurrentUser() user: AuthUser, @Body() dto: JobPhotoEditDto, @Req() req: Request) {
    return this.photoAi.edit(user, dto, req);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.jobs.findMine(user, req);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.jobs.findOne(user, id, req);
  }

  @Patch(':id')
  @Roles(Role.HOMEOWNER, Role.CONTRACTOR)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateJobDto,
    @Req() req: Request,
  ) {
    return this.jobs.update(user, id, dto, req);
  }

  @Post(':id/close')
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.jobs.close(user, id, req);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.jobs.cancel(user, id, req);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.remove(user, id);
  }
}
