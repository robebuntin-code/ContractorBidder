import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationType,
  Payment,
  PaymentDirection,
  PaymentStatus,
  Prisma,
} from '../generated/prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../common/feature-flags.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

/** Acceptance fee charged to each side, in cents ($1.00). */
const ACCEPTANCE_FEE_CENTS = 100;

export interface AcceptanceFeeParties {
  jobId: string;
  bidId: string;
  homeownerUserId: string;
  contractorUserId: string;
  currency: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');
  private readonly stripe?: Stripe;
  private readonly webhookSecret?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') || undefined;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2024-06-20' });
    }
  }

  get enabled(): boolean {
    return this.flags.flags.paymentsEnabled;
  }

  /** Create the two PENDING $1 acceptance-fee rows inside the accept transaction. */
  async createAcceptanceFees(parties: AcceptanceFeeParties, tx: Prisma.TransactionClient) {
    const base = {
      jobId: parties.jobId,
      bidId: parties.bidId,
      amountCents: ACCEPTANCE_FEE_CENTS,
      currency: parties.currency,
      status: PaymentStatus.PENDING,
    };
    const [homeownerFee, contractorFee] = await Promise.all([
      tx.payment.create({
        data: { ...base, userId: parties.homeownerUserId, direction: PaymentDirection.HOMEOWNER_ACCEPT_FEE },
      }),
      tx.payment.create({
        data: { ...base, userId: parties.contractorUserId, direction: PaymentDirection.CONTRACTOR_ACCEPT_FEE },
      }),
    ]);
    this.logger.log(`Created acceptance fees for job ${parties.jobId}.`);
    return { homeownerFee, contractorFee };
  }

  /**
   * Create (or reuse) a Stripe PaymentIntent for the caller's acceptance fee and
   * return its client secret for the client-side Payment Element.
   */
  async createSession(
    userId: string,
    input: { jobId: string; bidId: string; direction: PaymentDirection },
  ) {
    if (!this.enabled) {
      throw new UnprocessableEntityException({
        code: 'PAYMENTS_DISABLED',
        message: 'Payments are currently disabled by feature flag.',
      });
    }
    if (!this.stripe) {
      throw new UnprocessableEntityException({
        code: 'STRIPE_NOT_CONFIGURED',
        message: 'STRIPE_SECRET_KEY is not configured on the server.',
      });
    }

    const payment = await this.prisma.payment.findFirst({
      where: { userId, jobId: input.jobId, bidId: input.bidId, direction: input.direction },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'No matching pending payment for this user / job / direction.',
      });
    }
    if (payment.status === PaymentStatus.SUCCEEDED) {
      throw new UnprocessableEntityException({
        code: 'ALREADY_PAID',
        message: 'This fee has already been paid.',
      });
    }

    const intent = await this.stripe.paymentIntents.create({
      amount: payment.amountCents,
      currency: payment.currency.toLowerCase(),
      metadata: { paymentId: payment.id, jobId: payment.jobId, direction: payment.direction },
      automatic_payment_methods: { enabled: true },
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentIntentId: intent.id },
    });

    return { paymentId: payment.id, clientSecret: intent.client_secret };
  }

  /** Verify + handle a Stripe webhook (raw body required for signature check). */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!this.stripe || !this.webhookSecret) {
      throw new UnprocessableEntityException({
        code: 'STRIPE_NOT_CONFIGURED',
        message: 'Stripe webhook is not configured.',
      });
    }
    if (!rawBody || !signature) {
      throw new ForbiddenException({ code: 'BAD_WEBHOOK', message: 'Missing body or signature.' });
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (err) {
      this.logger.warn(`Stripe signature verification failed: ${(err as Error).message}`);
      throw new ForbiddenException({ code: 'BAD_SIGNATURE', message: 'Invalid webhook signature.' });
    }

    if (event.type === 'payment_intent.succeeded') {
      await this.markByIntent(event.data.object as Stripe.PaymentIntent, PaymentStatus.SUCCEEDED);
    } else if (
      event.type === 'payment_intent.payment_failed' ||
      event.type === 'payment_intent.canceled'
    ) {
      const status =
        event.type === 'payment_intent.canceled' ? PaymentStatus.CANCELLED : PaymentStatus.FAILED;
      await this.markByIntent(event.data.object as Stripe.PaymentIntent, status);
    }

    return { received: true };
  }

  async getById(userId: string, id: string) {
    return this.prisma.payment.findFirst({ where: { id, userId } });
  }

  private async markByIntent(intent: Stripe.PaymentIntent, status: PaymentStatus) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentIntentId: intent.id },
    });
    if (!payment) {
      this.logger.warn(`Webhook for unknown PaymentIntent ${intent.id}`);
      return;
    }
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status } });

    if (status === PaymentStatus.SUCCEEDED) {
      await this.onFeeSucceeded(payment);
    }
  }

  /** When both acceptance fees for a job succeed, reveal the location to the winner. */
  private async onFeeSucceeded(payment: Payment) {
    const fees = await this.prisma.payment.findMany({
      where: { jobId: payment.jobId, bidId: payment.bidId },
    });
    const bothSucceeded =
      fees.length === 2 && fees.every((f) => f.status === PaymentStatus.SUCCEEDED);
    if (!bothSucceeded) return;

    const bid = payment.bidId
      ? await this.prisma.bid.findUnique({ where: { id: payment.bidId } })
      : null;
    if (!bid) return;

    await this.audit.log({
      action: 'LOCATION_REVEALED',
      entity: 'job',
      entityId: payment.jobId,
      meta: { reason: 'both_acceptance_fees_succeeded', bidId: payment.bidId },
    });

    await this.notifications.notify({
      userId: bid.contractorUserId,
      type: NotificationType.BID_ACCEPTED,
      data: {
        jobId: payment.jobId,
        bidId: payment.bidId,
        message: 'Payment complete. The job address is now visible.',
      },
    });
  }
}
