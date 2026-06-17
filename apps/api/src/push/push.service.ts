import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WORK_TYPE_LABELS: Record<string, string> = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  landscaping: 'Landscaping',
  hauling: 'Hauling',
  carpentry: 'Carpentry',
  handyman: 'Handyman',
  other: 'Other',
};

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Push delivery abstraction. The dev implementation looks up a user's
 * registered device tokens and logs what *would* be sent. Swap `deliver()` for
 * a real provider:
 *   - Android/Web: Firebase Cloud Messaging (firebase-admin `messaging().sendEachForMulticast`)
 *   - iOS: APNs (node-apn / FCM)
 * Invalid tokens returned by the provider should be pruned from `devices`.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    const devices = await this.prisma.device.findMany({ where: { userId } });
    if (devices.length === 0) return 0;
    return this.deliver(devices.map((d) => d.token), payload);
  }

  /** Build a push payload from a notification type + data envelope. */
  templateFor(type: NotificationType, data: Record<string, unknown>): PushPayload {
    const title = (data.title as string) ?? 'DOJOBID';
    const map: Record<NotificationType, string> = {
      JOB_MATCH: `New ${WORK_TYPE_LABELS[(data.workType as string) ?? ''] ?? (data.workType as string) ?? ''} job near you`.trim(),
      NEW_BID: `New bid on your job`,
      BID_SUBMITTED: `Bid submitted`,
      BID_ACCEPTED: `Your bid was accepted`,
      MESSAGE: `New message on ${title}`,
      PAYMENT_REQUIRED: `Action needed: complete your $1 fee to view the address`,
    };
    return {
      title: type === 'MESSAGE' || type === 'NEW_BID' || type === 'BID_SUBMITTED' ? title : map[type],
      body: (data.message as string) ?? map[type],
      data: { type, ...this.stringifyValues(data) },
    };
  }

  private async deliver(tokens: string[], payload: PushPayload): Promise<number> {
    // DEV: no real FCM/APNs integration configured.
    this.logger.log(`[dev push] -> ${tokens.length} device(s): ${payload.title} — ${payload.body}`);
    return tokens.length;
  }

  private stringifyValues(data: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v != null) out[k] = String(v);
    }
    return out;
  }
}
