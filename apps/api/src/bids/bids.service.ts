import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Bid, BidStatus, JobStatus, NotificationType, Prisma, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateBidDto } from './dto/bid.dto';
import { toAcceptBidResponse, toBidView } from './bid.serializer';

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(user: AuthUser, jobId: string, dto: CreateBidDto) {
    if (user.role !== Role.CONTRACTOR) {
      throw new ForbiddenException({
        code: 'CONTRACTOR_ONLY',
        message: 'Only contractors can place bids.',
      });
    }

    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });
    if (job.createdByUserId === user.userId) {
      throw new ForbiddenException({
        code: 'CANNOT_BID_OWN_JOB',
        message: 'You cannot bid on your own job.',
      });
    }
    if (job.status !== JobStatus.OPEN) {
      throw new ConflictException({
        code: 'JOB_NOT_OPEN',
        message: 'This job is no longer accepting bids.',
      });
    }

    try {
      const bid = await this.prisma.bid.create({
        data: {
          jobId,
          contractorUserId: user.userId,
          amount: dto.amountCents,
          currency: dto.currency ?? 'USD',
          message: dto.message,
        },
      });

      await this.afterBidPlaced(job, bid, user.userId);
      return toBidView(bid);
    } catch (e) {
      // One row per contractor per job — update an existing pending bid instead of failing.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.bid.findUnique({
          where: { jobId_contractorUserId: { jobId, contractorUserId: user.userId } },
        });
        if (!existing || existing.status !== BidStatus.PENDING) {
          throw new ConflictException({
            code: 'DUPLICATE_BID',
            message: 'You already have a bid on this job. Withdraw it before bidding again.',
          });
        }

        const bid = await this.prisma.bid.update({
          where: { id: existing.id },
          data: {
            amount: dto.amountCents,
            currency: dto.currency ?? 'USD',
            message: dto.message,
          },
        });

        await this.afterBidPlaced(job, bid, user.userId);
        return toBidView(bid);
      }
      throw e;
    }
  }

  private async afterBidPlaced(
    job: { id: string; title: string; createdByUserId: string },
    bid: Bid,
    contractorUserId: string,
  ) {
    const bidAmount = (bid.amount / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: bid.currency,
    });

    this.realtime.emitToJob(job.id, 'bid', toBidView(bid));
    await this.notifications.notify({
      userId: job.createdByUserId,
      type: NotificationType.NEW_BID,
      data: {
        jobId: job.id,
        bidId: bid.id,
        amountCents: bid.amount,
        title: job.title,
        message: `New bid of ${bidAmount} on "${job.title}"`,
      },
    });
    await this.notifications.notify({
      userId: contractorUserId,
      type: NotificationType.BID_SUBMITTED,
      data: {
        jobId: job.id,
        bidId: bid.id,
        title: job.title,
        amountCents: bid.amount,
        message: `You bid ${bidAmount} on "${job.title}"`,
      },
    });
  }

  /**
   * Owners see all bids (with contractor profile preview). Contractors see only
   * their own bid unless the owner has enabled group-visible Q&A (future flag).
   */
  async listForJob(user: AuthUser, jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });

    const isOwner = job.createdByUserId === user.userId;
    const bids = await this.prisma.bid.findMany({
      where: { jobId, ...(isOwner ? {} : { contractorUserId: user.userId }) },
      orderBy: { amount: 'asc' },
      include: isOwner
        ? { contractor: { include: { contractorProfile: true } } }
        : undefined,
    });

    return bids.map((b, index) =>
      toBidView(b, isOwner, {
        anonymousLabel: `Contractor #${index + 1}`,
        revealIdentity: b.status === BidStatus.ACCEPTED,
      }),
    );
  }

  async withdraw(user: AuthUser, bidId: string) {
    const bid = await this.prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) throw new NotFoundException({ code: 'BID_NOT_FOUND', message: 'Bid not found.' });
    if (bid.contractorUserId !== user.userId) {
      throw new ForbiddenException({
        code: 'NOT_BID_OWNER',
        message: 'You can only withdraw your own bid.',
      });
    }
    if (bid.status !== BidStatus.PENDING) {
      throw new ConflictException({
        code: 'BID_NOT_PENDING',
        message: `Cannot withdraw a bid in status ${bid.status}.`,
      });
    }
    const updated = await this.prisma.bid.update({
      where: { id: bidId },
      data: { status: BidStatus.WITHDRAWN },
    });
    return toBidView(updated);
  }

  /**
   * Accept a bid. Runs in a transaction: marks the bid ACCEPTED, awards the job,
   * auto-declines the other pending bids, and (if payments are enabled) creates
   * the homeowner acceptance-fee row. Precise location reveal is gated on payment in
   * jobs.service; with payments off it's revealed immediately to the winner.
   */
  async accept(user: AuthUser, bidId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const bid = await tx.bid.findUnique({ where: { id: bidId } });
      if (!bid) throw new NotFoundException({ code: 'BID_NOT_FOUND', message: 'Bid not found.' });

      const job = await tx.job.findUnique({ where: { id: bid.jobId } });
      if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });

      if (job.createdByUserId !== user.userId) {
        throw new ForbiddenException({
          code: 'NOT_JOB_OWNER',
          message: 'Only the job owner can accept a bid.',
        });
      }
      if (job.status !== JobStatus.OPEN) {
        throw new ConflictException({
          code: 'JOB_NOT_OPEN',
          message: 'This job is not open for acceptance.',
        });
      }
      if (bid.status !== BidStatus.PENDING) {
        throw new ConflictException({
          code: 'BID_NOT_PENDING',
          message: `Cannot accept a bid in status ${bid.status}.`,
        });
      }

      const acceptedBid = await tx.bid.update({
        where: { id: bid.id },
        data: { status: BidStatus.ACCEPTED },
      });

      await tx.bid.updateMany({
        where: { jobId: job.id, status: BidStatus.PENDING, id: { not: bid.id } },
        data: { status: BidStatus.DECLINED },
      });

      await tx.job.update({
        where: { id: job.id },
        data: { acceptedBidId: bid.id, status: JobStatus.AWARDED },
      });

      const paymentsEnabled = this.payments.enabled;
      let homeownerFeeId: string | null = null;
      if (paymentsEnabled) {
        const { homeownerFee } = await this.payments.createAcceptanceFees(
          {
            jobId: job.id,
            bidId: bid.id,
            homeownerUserId: job.createdByUserId,
            contractorUserId: bid.contractorUserId,
            currency: bid.currency,
          },
          tx,
        );
        homeownerFeeId = homeownerFee.id;
      }

      await this.audit.log(
        {
          actorUserId: user.userId,
          action: 'BID_ACCEPTED',
          entity: 'bid',
          entityId: bid.id,
          meta: { jobId: job.id, paymentsEnabled, locationRevealed: !paymentsEnabled },
        },
        tx,
      );

      return { job, acceptedBid, paymentsEnabled, homeownerFeeId };
    });

    const acceptedWithProfile = await this.prisma.bid.findUnique({
      where: { id: result.acceptedBid.id },
      include: { contractor: { include: { contractorProfile: true } } },
    });

    if (result.paymentsEnabled) {
      await this.notifications.notify({
        userId: result.job.createdByUserId,
        type: NotificationType.PAYMENT_REQUIRED,
        data: {
          jobId: result.job.id,
          bidId: result.acceptedBid.id,
          message: 'Pay the $1 acceptance fee to share the job address with your contractor.',
        },
      });
      await this.notifications.notify({
        userId: result.acceptedBid.contractorUserId,
        type: NotificationType.BID_ACCEPTED,
        data: {
          jobId: result.job.id,
          bidId: result.acceptedBid.id,
          message:
            'Your bid was accepted. The address will appear once the homeowner pays the $1 acceptance fee.',
        },
      });
    } else {
      await this.notifications.notify({
        userId: result.acceptedBid.contractorUserId,
        type: NotificationType.BID_ACCEPTED,
        data: {
          jobId: result.job.id,
          bidId: result.acceptedBid.id,
          message: 'Your bid was accepted. The job address is now visible.',
        },
      });
    }

    return toAcceptBidResponse(
      acceptedWithProfile ?? result.acceptedBid,
      {
        paymentRequired: result.paymentsEnabled,
        jobId: result.job.id,
        bidId: result.acceptedBid.id,
        homeownerPaymentId: result.homeownerFeeId,
      },
      { revealIdentity: true },
    );
  }
}
