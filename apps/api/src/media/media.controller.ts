import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { MediaService } from './media.service';
import { SignUploadDto } from './dto/sign-upload.dto';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('sign-upload')
  signUpload(@CurrentUser() user: AuthUser, @Body() dto: SignUploadDto, @Req() req: Request) {
    return this.media.signUpload(user.userId, dto, req);
  }
}
