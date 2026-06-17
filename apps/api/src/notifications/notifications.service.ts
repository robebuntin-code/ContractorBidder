import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  data: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Persist an in-app notification, push it live to the user's open clients via
   * websocket, and best-effort fan out a device push. In production the push
   * would be enqueued (SQS/pub-sub) rather than sent inline.
   */
  async notify(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: { userId: input.userId, type: input.type, data: input.data },
    });
    this.realtime.emitToUser(input.userId, 'notification', notification);
    void this.tryPush(input);
    return notification;
  }

  /** Bulk fan-out (e.g. JOB_MATCH to many contractors). */
  async notifyMany(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) return { count: 0 };
    const res = await this.prisma.notification.createMany({
      data: inputs.map((i) => ({ userId: i.userId, type: i.type, data: i.data })),
    });
    for (const input of inputs) {
      this.realtime.emitToUser(input.userId, 'notification', { type: input.type, data: input.data });
      void this.tryPush(input);
    }
    return res;
  }

  private async tryPush(input: CreateNotificationInput) {
    try {
      const payload = this.push.templateFor(
        input.type,
        (input.data as Record<string, unknown>) ?? {},
      );
      await this.push.sendToUser(input.userId, payload);
    } catch (err) {
      this.logger.warn(`Push delivery failed for ${input.userId}: ${(err as Error).message}`);
    }
  }

  async list(userId: string, onlyUnread = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(onlyUnread ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, ids?: string[]) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids && ids.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  /** Remove notifications from the activity feed (all, or specific ids). */
  async clear(userId: string, ids?: string[]) {
    const res = await this.prisma.notification.deleteMany({
      where: { userId, ...(ids && ids.length ? { id: { in: ids } } : {}) },
    });
    return { deleted: res.count };
  }
}
