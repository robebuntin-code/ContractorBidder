import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JobStatus,
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

/** Acceptance fee charged to the homeowner when accepting a bid, in cents ($1.00). */
const ACCEPTANCE_FEE_CENTS = 100;

export interface AcceptanceFeeParties {
  jobId: string;
  bidId: string;
  homeownerUserId: string;
  contractorUserId: string;
  currency: string;
}

export interface AcceptanceFeeStatusResponse {
  required: boolean;
  status: 'NONE' | PaymentStatus;
  jobId: string;
  bidId?: string | null;
  paymentId?: string | null;
  amountCents: number;
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

  /** Create the homeowner PENDING $1 acceptance-fee row inside the accept transaction. */
  async createAcceptanceFees(parties: AcceptanceFeeParties, tx: Prisma.TransactionClient) {
    const homeownerFee = await tx.payment.create({
      data: {
        jobId: parties.jobId,
        bidId: parties.bidId,
        userId: parties.homeownerUserId,
        amountCents: ACCEPTANCE_FEE_CENTS,
        currency: parties.currency,
        status: PaymentStatus.PENDING,
        direction: PaymentDirection.HOMEOWNER_ACCEPT_FEE,
      },
    });
    this.logger.log(`Created homeowner acceptance fee for job ${parties.jobId}.`);
    return { homeownerFee };
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
    if (input.direction !== PaymentDirection.HOMEOWNER_ACCEPT_FEE) {
      throw new UnprocessableEntityException({
        code: 'INVALID_PAYMENT_DIRECTION',
        message: 'Only the homeowner acceptance fee can be paid through this flow.',
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

    if (payment.providerPaymentIntentId) {
      const existing = await this.stripe.paymentIntents.retrieve(payment.providerPaymentIntentId);
      if (existing.status === 'succeeded') {
        throw new UnprocessableEntityException({
          code: 'ALREADY_PAID',
          message: 'This fee has already been paid.',
        });
      }
      if (
        existing.status === 'requires_payment_method' ||
        existing.status === 'requires_confirmation' ||
        existing.status === 'requires_action' ||
        existing.status === 'processing'
      ) {
        return { paymentId: payment.id, clientSecret: existing.client_secret };
      }
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

  async getAcceptanceFeeStatus(userId: string, jobId: string): Promise<AcceptanceFeeStatusResponse> {
    const none: AcceptanceFeeStatusResponse = {
      required: false,
      status: 'NONE',
      jobId,
      amountCents: ACCEPTANCE_FEE_CENTS,
      currency: 'USD',
    };

    if (!this.enabled) return none;

    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });
    }
    if (job.createdByUserId !== userId) {
      throw new ForbiddenException({
        code: 'NOT_JOB_OWNER',
        message: 'Only the job owner can view acceptance fee status.',
      });
    }
    if (job.status !== JobStatus.AWARDED || !job.acceptedBidId) return none;

    const payment = await this.prisma.payment.findFirst({
      where: {
        jobId,
        bidId: job.acceptedBidId,
        userId,
        direction: PaymentDirection.HOMEOWNER_ACCEPT_FEE,
      },
    });
    if (!payment) return none;

    return {
      required: payment.status === PaymentStatus.PENDING,
      status: payment.status,
      jobId,
      bidId: job.acceptedBidId,
      paymentId: payment.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
    };
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
      await this.onHomeownerFeeSucceeded(payment);
    }
  }

  /** When the homeowner acceptance fee succeeds, reveal the location to the contractor. */
  private async onHomeownerFeeSucceeded(payment: Payment) {
    if (payment.direction !== PaymentDirection.HOMEOWNER_ACCEPT_FEE) return;

    await this.audit.log({
      action: 'LOCATION_REVEALED',
      entity: 'job',
      entityId: payment.jobId,
      meta: { reason: 'homeowner_acceptance_fee_succeeded', bidId: payment.bidId },
    });

    const bid = payment.bidId
      ? await this.prisma.bid.findUnique({ where: { id: payment.bidId } })
      : null;
    if (!bid) return;

    await this.notifications.notify({
      userId: payment.userId,
      type: NotificationType.BID_ACCEPTED,
      data: {
        jobId: payment.jobId,
        bidId: payment.bidId,
        message: 'Payment complete. The contractor can now see the job address.',
      },
    });

    await this.notifications.notify({
      userId: bid.contractorUserId,
      type: NotificationType.BID_ACCEPTED,
      data: {
        jobId: payment.jobId,
        bidId: payment.bidId,
        message: 'The homeowner paid the acceptance fee. The job address is now visible.',
      },
    });
  }
}
