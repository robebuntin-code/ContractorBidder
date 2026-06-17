import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Job, JobStatus, NotificationType, Role, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { FeatureFlagsService } from '../common/feature-flags.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { Request } from 'express';
import type { Message } from '../generated/prisma/client';
import { MediaService } from '../media/media.service';
import { CreateMessageDto } from './dto/message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly flags: FeatureFlagsService,
    private readonly media: MediaService,
  ) {}

  async create(user: AuthUser, jobId: string, dto: CreateMessageDto, req?: Request) {
    const job = await this.getJobOrThrow(jobId);
    await this.assertParticipant(job, user.userId, user);
    await this.assertParticipant(job, dto.toUserId);

    if (dto.toUserId === user.userId) {
      throw new ForbiddenException({
        code: 'CANNOT_MESSAGE_SELF',
        message: 'You cannot message yourself.',
      });
    }

    if (user.role === Role.CONTRACTOR && user.userId !== job.createdByUserId) {
      const hasBid = await this.hasBid(job.id, user.userId);
      if (!hasBid) {
        if (job.status !== JobStatus.OPEN) {
          throw new ForbiddenException({
            code: 'JOB_NOT_OPEN',
            message: 'You can only ask questions on open jobs before placing a bid.',
          });
        }
        if (dto.toUserId !== job.createdByUserId) {
          throw new ForbiddenException({
            code: 'PRE_BID_OWNER_ONLY',
            message: 'Before bidding, you may only message the job owner.',
          });
        }
      }
    }

    if (user.userId === job.createdByUserId) {
      await this.assertOwnerCanMessageContractor(job, dto.toUserId);
    }

    const body = (dto.body ?? '').trim();
    const attachments = dto.attachments ?? [];
    const maxAttachments = this.flags.flags.jobsMaxPhotos;
    if (!body && attachments.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_MESSAGE',
        message: 'Enter a message or attach at least one photo.',
      });
    }
    if (attachments.length > maxAttachments) {
      throw new BadRequestException({
        code: 'TOO_MANY_ATTACHMENTS',
        message: `A message may have at most ${maxAttachments} photos.`,
      });
    }

    const message = await this.prisma.message.create({
      data: {
        jobId,
        fromUserId: user.userId,
        toUserId: dto.toUserId,
        body,
        attachments,
        visibility: 'DIRECT',
      },
    });

    const serialized = this.serializeMessage(message, req);
    this.realtime.emitToJob(jobId, 'message', serialized);

    await this.notifications.notify({
      userId: dto.toUserId,
      type: NotificationType.MESSAGE,
      data: { jobId, messageId: message.id, title: job.title, fromUserId: user.userId },
    });

    return serialized;
  }

  /** Returns the direct thread visible to the caller for this job. */
  async listForJob(user: AuthUser, jobId: string, req?: Request) {
    const job = await this.getJobOrThrow(jobId);
    await this.assertParticipant(job, user.userId, user);

    const messages = await this.prisma.message.findMany({
      where: {
        jobId,
        OR: [{ fromUserId: user.userId }, { toUserId: user.userId }],
      },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((message) => this.serializeMessage(message, req));
  }

  private serializeMessage(message: Message, req?: Request) {
    return {
      ...message,
      attachments: message.attachments.map((url) => this.media.resolvePublicUrl(url, req)),
    };
  }

  private async getJobOrThrow(jobId: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });
    return job;
  }

  private async hasBid(jobId: string, contractorUserId: string): Promise<boolean> {
    const bid = await this.prisma.bid.findFirst({
      where: { jobId, contractorUserId },
    });
    return !!bid;
  }

  /**
   * A participant is the job owner, a contractor who has bid, a contractor with an
   * existing thread on the job, or a contractor viewing an open job (pre-bid questions).
   */
  private async assertParticipant(job: Job, userId: string, actingUser?: AuthUser) {
    if (job.createdByUserId === userId) return;

    if (await this.hasBid(job.id, userId)) return;

    const existingMessage = await this.prisma.message.findFirst({
      where: {
        jobId: job.id,
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
    });
    if (existingMessage) return;

    if (job.status === JobStatus.OPEN) {
      const role = actingUser?.role ?? (await this.getUserRole(userId));
      if (role === Role.CONTRACTOR) return;
    }

    throw new ForbiddenException({
      code: 'NOT_JOB_PARTICIPANT',
      message: 'You are not allowed to use this job thread.',
    });
  }

  /** Owners may reply to contractors who bid or who asked a pre-bid question. */
  private async assertOwnerCanMessageContractor(job: Job, contractorUserId: string) {
    if (contractorUserId === job.createdByUserId) {
      throw new ForbiddenException({
        code: 'INVALID_RECIPIENT',
        message: 'You cannot message yourself.',
      });
    }

    if (await this.hasBid(job.id, contractorUserId)) return;

    const askedQuestion = await this.prisma.message.findFirst({
      where: {
        jobId: job.id,
        OR: [
          { fromUserId: contractorUserId, toUserId: job.createdByUserId },
          { fromUserId: job.createdByUserId, toUserId: contractorUserId },
        ],
      },
    });
    if (askedQuestion) return;

    throw new ForbiddenException({
      code: 'CONTRACTOR_NOT_CONTACTABLE',
      message: 'You can only message contractors who have bid or asked a question on this job.',
    });
  }

  private async getUserRole(userId: string): Promise<Role | null> {
    const user: Pick<User, 'role'> | null = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role ?? null;
  }
}
