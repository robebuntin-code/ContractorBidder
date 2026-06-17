import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { contractorProfile: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    return {
      ...this.auth.toPublicUser(user),
      phone: user.phone,
      homeAddress: user.homeAddress,
      contractorProfile: user.contractorProfile,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.homeAddress !== undefined) data.homeAddress = dto.homeAddress.trim() || null;

    await this.prisma.user.update({ where: { id: userId }, data });
    return this.getMe(userId);
  }
}
