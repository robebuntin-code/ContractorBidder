import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Job, JobStatus, PaymentStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../common/feature-flags.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { boundingBox, haversineKm, toCoarse } from '../common/geo.util';
import { MediaService } from '../media/media.service';
import { CreateJobDto, JobPhotoComparisonDto, JobSearchQueryDto } from './dto/job.dto';
import { toCoarseView, toFullView } from './job.serializer';
import { MatchingService } from './matching.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger('Jobs');

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
    private readonly matching: MatchingService,
    private readonly media: MediaService,
  ) {}

  private photoResolver(req?: Request) {
    return (url: string) => this.media.resolvePublicUrl(url, req);
  }

  private normalizePhotos(photos: string[] | undefined): string[] {
    return (photos ?? []).map((url) => this.media.normalizeStoredUrl(url));
  }

  private normalizeComparisons(
    userId: string,
    comparisons: JobPhotoComparisonDto[] | undefined,
  ): JobPhotoComparisonDto[] {
    const max = this.flags.flags.jobsMaxPhotoComparisons;
    const list = comparisons ?? [];
    if (list.length > max) {
      throw new UnprocessableEntityException({
        code: 'TOO_MANY_PHOTO_COMPARISONS',
        message: `A job may have at most ${max} before/after scope photos.`,
      });
    }

    const prefix = `uploads/${userId}/`;
    return list.map((pair) => {
      const before = this.media.normalizeStoredUrl(pair.before);
      const after = this.media.normalizeStoredUrl(pair.after);
      if (!before.startsWith(prefix) || !after.startsWith(prefix)) {
        throw new ForbiddenException({
          code: 'NOT_YOUR_UPLOAD',
          message: 'Scope photos must be uploads you own.',
        });
      }
      return { before, after };
    });
  }

  async create(user: AuthUser, dto: CreateJobDto, req?: Request) {
    const maxPhotos = this.flags.flags.jobsMaxPhotos;
    if (dto.photos && dto.photos.length > maxPhotos) {
      throw new UnprocessableEntityException({
        code: 'TOO_MANY_PHOTOS',
        message: `A job may have at most ${maxPhotos} photos.`,
      });
    }
    if (dto.budgetMin != null && dto.budgetMax != null && dto.budgetMin > dto.budgetMax) {
      throw new BadRequestException({
        code: 'INVALID_BUDGET_RANGE',
        message: 'budgetMin cannot exceed budgetMax.',
      });
    }

    const desiredStart = new Date(dto.desiredDatetimeStart);
    const desiredEnd = dto.desiredDatetimeEnd ? new Date(dto.desiredDatetimeEnd) : null;
    if (desiredEnd && desiredEnd < desiredStart) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'desiredDatetimeEnd cannot be before desiredDatetimeStart.',
      });
    }

    // In production, geocode addressText -> lat/lng here (Mapbox/Google).
    const coarse = toCoarse({ lat: dto.lat, lng: dto.lng });

    const job = await this.prisma.job.create({
      data: {
        createdByUserId: user.userId,
        createdByRole: user.role,
        title: dto.title,
        description: dto.description,
        workType: dto.workType,
        desiredDatetimeStart: new Date(dto.desiredDatetimeStart),
        desiredDatetimeEnd: dto.desiredDatetimeEnd ? new Date(dto.desiredDatetimeEnd) : null,
        photos: this.normalizePhotos(dto.photos),
        photoComparisons: this.normalizeComparisons(user.userId, dto.photoComparisons) as unknown as Prisma.InputJsonValue,
        addressText: dto.addressText,
        contactPhone: dto.contactPhone?.trim() || null,
        locationPrecision: dto.locationPrecision ?? 'PRECISE',
        preciseLat: dto.lat,
        preciseLng: dto.lng,
        coarseLat: coarse.lat,
        coarseLng: coarse.lng,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        currency: dto.currency ?? 'USD',
      },
    });

    // Fan out JOB_MATCH notifications to nearby, work-type-matching contractors.
    // Failure here must not fail job creation, so we isolate and log it.
    try {
      await this.matching.notifyMatchingContractors(job);
    } catch (err) {
      this.logger.error(`JOB_MATCH fan-out failed for job ${job.id}`, err as Error);
    }

    return toFullView(job, this.photoResolver(req));
  }

  /** Owner may edit an open job that has not received any bids yet. */
  async update(user: AuthUser, id: string, dto: CreateJobDto, req?: Request) {
    const job = await this.getJobOrThrow(id);
    if (job.createdByUserId !== user.userId) {
      throw new ForbiddenException({
        code: 'NOT_JOB_OWNER',
        message: 'Only the job owner can edit this job.',
      });
    }
    if (job.status !== JobStatus.OPEN) {
      throw new BadRequestException({
        code: 'JOB_NOT_OPEN',
        message: 'Only open jobs can be edited.',
      });
    }

    const bidCount = await this.prisma.bid.count({ where: { jobId: id } });
    if (bidCount > 0) {
      throw new BadRequestException({
        code: 'JOB_HAS_BIDS',
        message: 'This job cannot be edited after a bid has been placed.',
      });
    }

    const maxPhotos = this.flags.flags.jobsMaxPhotos;
    if (dto.photos && dto.photos.length > maxPhotos) {
      throw new UnprocessableEntityException({
        code: 'TOO_MANY_PHOTOS',
        message: `A job may have at most ${maxPhotos} photos.`,
      });
    }
    if (dto.budgetMin != null && dto.budgetMax != null && dto.budgetMin > dto.budgetMax) {
      throw new BadRequestException({
        code: 'INVALID_BUDGET_RANGE',
        message: 'budgetMin cannot exceed budgetMax.',
      });
    }

    const desiredStart = new Date(dto.desiredDatetimeStart);
    const desiredEnd = dto.desiredDatetimeEnd ? new Date(dto.desiredDatetimeEnd) : null;
    if (desiredEnd && desiredEnd < desiredStart) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'desiredDatetimeEnd cannot be before desiredDatetimeStart.',
      });
    }

    const coarse = toCoarse({ lat: dto.lat, lng: dto.lng });

    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        workType: dto.workType,
        desiredDatetimeStart: desiredStart,
        desiredDatetimeEnd: desiredEnd,
        photos: this.normalizePhotos(dto.photos),
        photoComparisons: this.normalizeComparisons(user.userId, dto.photoComparisons) as unknown as Prisma.InputJsonValue,
        addressText: dto.addressText,
        contactPhone: dto.contactPhone?.trim() || null,
        locationPrecision: dto.locationPrecision ?? job.locationPrecision,
        preciseLat: dto.lat,
        preciseLng: dto.lng,
        coarseLat: coarse.lat,
        coarseLng: coarse.lng,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        currency: dto.currency ?? job.currency,
      },
    });

    return toFullView(updated, this.photoResolver(req));
  }

  /**
   * Radius search using a cheap bounding-box pre-filter in SQL followed by an
   * exact Haversine distance computed in app code. Returns COARSE views only.
   * Excludes jobs posted by the searcher (e.g. a contractor's own listings).
   */
  async search(user: AuthUser, q: JobSearchQueryDto, req?: Request) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const box = boundingBox({ lat: q.lat, lng: q.lng }, q.radiusKm);

    const where: Prisma.JobWhereInput = {
      createdByUserId: { not: user.userId },
      coarseLat: { gte: box.minLat, lte: box.maxLat },
      coarseLng: { gte: box.minLng, lte: box.maxLng },
      ...(q.workType ? { workType: q.workType } : {}),
      ...(q.createdByRole ? { createdByRole: q.createdByRole } : {}),
      ...(q.onlyOpen === false ? {} : { status: JobStatus.OPEN }),
    };

    const candidates = await this.prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const within = candidates
      .map((job) => ({
        job,
        distanceKm: haversineKm(
          { lat: q.lat, lng: q.lng },
          { lat: job.coarseLat, lng: job.coarseLng },
        ),
      }))
      .filter((row) => row.distanceKm <= q.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const total = within.length;
    const items = within
      .slice((page - 1) * pageSize, page * pageSize)
      .map((row) => toCoarseView(row.job, row.distanceKm, this.photoResolver(req)));

    return { items, page, pageSize, total };
  }

  async findOne(user: AuthUser, id: string, req?: Request) {
    const job = await this.getJobOrThrow(id);
    const resolve = this.photoResolver(req);

    // The owner always sees the full record.
    if (job.createdByUserId === user.userId) return toFullView(job, resolve);

    // The accepted contractor sees precise location only once reveal is allowed
    // (immediately when payments are off; after both fees succeed when on).
    const acceptedContractorUserId = await this.acceptedContractor(job);
    const isAcceptedContractor =
      !!acceptedContractorUserId && acceptedContractorUserId === user.userId;
    if (isAcceptedContractor && (await this.revealAllowed(job))) {
      return toFullView(job, resolve);
    }
    return toCoarseView(job, undefined, resolve);
  }

  /** Whether the precise location may be revealed to the accepted contractor. */
  private async revealAllowed(job: Job): Promise<boolean> {
    if (!this.flags.flags.paymentsEnabled) return true;
    const fees = await this.prisma.payment.findMany({ where: { jobId: job.id, bidId: job.acceptedBidId } });
    return fees.length === 2 && fees.every((f) => f.status === PaymentStatus.SUCCEEDED);
  }

  async findMine(user: AuthUser, req?: Request) {
    const jobs = await this.prisma.job.findMany({
      where: { createdByUserId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
    const resolve = this.photoResolver(req);
    return jobs.map((j) => toFullView(j, resolve));
  }

  async close(user: AuthUser, id: string, req?: Request) {
    return this.transition(user, id, JobStatus.CLOSED, req);
  }

  async cancel(user: AuthUser, id: string, req?: Request) {
    return this.transition(user, id, JobStatus.CANCELLED, req);
  }

  /** Permanently remove a job from the owner's list (not allowed once awarded). */
  async remove(user: AuthUser, id: string) {
    const job = await this.getJobOrThrow(id);
    if (job.createdByUserId !== user.userId) {
      throw new ForbiddenException({
        code: 'NOT_JOB_OWNER',
        message: 'Only the job owner can delete this job.',
      });
    }
    if (job.status === JobStatus.AWARDED) {
      throw new BadRequestException({
        code: 'JOB_AWARDED',
        message: 'Awarded jobs cannot be deleted.',
      });
    }

    await this.prisma.$transaction([
      this.prisma.payment.deleteMany({ where: { jobId: id } }),
      this.prisma.job.delete({ where: { id } }),
    ]);

    return { deleted: true };
  }

  private async transition(user: AuthUser, id: string, status: JobStatus, req?: Request) {
    const job = await this.getJobOrThrow(id);
    if (job.createdByUserId !== user.userId) {
      throw new ForbiddenException({
        code: 'NOT_JOB_OWNER',
        message: 'Only the job owner can change its status.',
      });
    }
    const updated = await this.prisma.job.update({ where: { id }, data: { status } });
    return toFullView(updated, this.photoResolver(req));
  }

  private async getJobOrThrow(id: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });
    return job;
  }

  private async acceptedContractor(job: Job): Promise<string | null> {
    if (!job.acceptedBidId) return null;
    const bid = await this.prisma.bid.findUnique({ where: { id: job.acceptedBidId } });
    return bid?.contractorUserId ?? null;
  }
}
