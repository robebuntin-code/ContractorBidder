import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminJobsQueryDto, AdminUsersQueryDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listJobs(q: AdminJobsQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const where: Prisma.JobWhereInput = q.status ? { status: q.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.job.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  async listUsers(q: AdminUsersQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const where: Prisma.UserWhereInput =
      q.banned === undefined ? {} : { isBanned: q.banned };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          isBanned: true,
          bannedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows, page, pageSize, total };
  }

  async setBanned(adminUserId: string, targetUserId: string, banned: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    if (user.role === Role.ADMIN) {
      throw new BadRequestException({
        code: 'CANNOT_BAN_ADMIN',
        message: 'Admin accounts cannot be banned.',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isBanned: banned, bannedAt: banned ? new Date() : null },
    });

    await this.audit.log({
      actorUserId: adminUserId,
      action: banned ? 'USER_BANNED' : 'USER_UNBANNED',
      entity: 'user',
      entityId: targetUserId,
    });

    return { id: updated.id, isBanned: updated.isBanned, bannedAt: updated.bannedAt };
  }
}
