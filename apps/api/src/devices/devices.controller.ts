import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(user.userId, dto);
  }

  @Delete(':token')
  @HttpCode(200)
  unregister(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.devices.unregister(user.userId, token);
  }
}
