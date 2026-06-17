import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Job, JobStatus, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { toPublicReviewView, toReviewView } from './review.serializer';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForJob(user: AuthUser, jobId: string) {
    const job = await this.getJobOrThrow(jobId);
    await this.assertCanAccessJobReview(user, job);

    const review = await this.prisma.contractorReview.findUnique({ where: { jobId } });
    return review ? toReviewView(review) : null;
  }

  async create(user: AuthUser, jobId: string, dto: CreateReviewDto) {
    const job = await this.getJobOrThrow(jobId);
    if (job.createdByUserId !== user.userId) {
      throw new ForbiddenException({
        code: 'NOT_JOB_OWNER',
        message: 'Only the job owner can review the contractor.',
      });
    }
    if (job.status !== JobStatus.AWARDED || !job.acceptedBidId) {
      throw new BadRequestException({
        code: 'JOB_NOT_AWARDED',
        message: 'You can review the contractor after a bid has been accepted.',
      });
    }

    const existing = await this.prisma.contractorReview.findUnique({ where: { jobId } });
    if (existing) {
      throw new ConflictException({
        code: 'REVIEW_EXISTS',
        message: 'You already submitted a review for this job.',
      });
    }

    const bid = await this.prisma.bid.findUnique({ where: { id: job.acceptedBidId } });
    if (!bid) {
      throw new NotFoundException({ code: 'BID_NOT_FOUND', message: 'Accepted bid not found.' });
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contractorReview.create({
        data: {
          jobId,
          contractorUserId: bid.contractorUserId,
          reviewerUserId: user.userId,
          rating: dto.rating,
          comment: dto.comment?.trim() || null,
        },
      });

      const agg = await tx.contractorReview.aggregate({
        where: { contractorUserId: bid.contractorUserId },
        _avg: { rating: true },
        _count: true,
      });

      await tx.contractorProfile.update({
        where: { userId: bid.contractorUserId },
        data: {
          ratingAgg: agg._avg.rating ?? 0,
          ratingCount: agg._count,
        },
      });

      return created;
    });

    return toReviewView(review);
  }

  async listForContractorPublic(contractorUserId: string) {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId: contractorUserId },
    });
    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: 'Contractor profile not found.',
      });
    }

    const reviews = await this.prisma.contractorReview.findMany({
      where: { contractorUserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        job: { select: { title: true } },
        reviewer: { select: { firstName: true, lastName: true } },
      },
    });

    return reviews.map(toPublicReviewView);
  }

  private async getJobOrThrow(jobId: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });
    return job;
  }

  private async assertCanAccessJobReview(user: AuthUser, job: Job) {
    if (job.createdByUserId === user.userId) return;
    if (user.role === Role.ADMIN) return;

    if (job.status === JobStatus.AWARDED && job.acceptedBidId) {
      const bid = await this.prisma.bid.findUnique({ where: { id: job.acceptedBidId } });
      if (bid?.contractorUserId === user.userId) return;
    }

    throw new ForbiddenException({
      code: 'NOT_ALLOWED',
      message: 'You cannot view this review.',
    });
  }
}
