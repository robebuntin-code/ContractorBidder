import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register (or re-assign) a device push token to the caller. Tokens are
   * globally unique; if the same token re-registers we update its owner/platform
   * (e.g. a shared device or a token reissued to a new user).
   */
  async register(userId: string, dto: RegisterDeviceDto) {
    const device = await this.prisma.device.upsert({
      where: { token: dto.token },
      create: { userId, platform: dto.platform, token: dto.token },
      update: { userId, platform: dto.platform },
    });
    return { id: device.id, platform: device.platform };
  }

  async unregister(userId: string, token: string) {
    await this.prisma.device.deleteMany({ where: { token, userId } });
    return { removed: true };
  }
}
