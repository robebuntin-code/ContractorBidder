import { Injectable, Logger } from '@nestjs/common';
import { Job, NotificationType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { haversineKm } from '../common/geo.util';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger('Matching');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Fan out JOB_MATCH notifications to contractors who:
   *   - list this job's work_type in their service_types, AND
   *   - have a base location within their own service_radius_km of the job's
   *     COARSE location (precise location is never used for matching).
   *
   * Distance is computed against the coarse point to preserve privacy. For
   * scale, replace the in-memory distance filter with a PostGIS ST_DWithin
   * query and rate-limit per contractor (e.g. max N JOB_MATCH per hour).
   */
  async notifyMatchingContractors(job: Job): Promise<number> {
    const candidates = await this.prisma.contractorProfile.findMany({
      where: {
        serviceTypes: { has: job.workType },
        baseLat: { not: null },
        baseLng: { not: null },
        // Never notify the contractor who posted the job (sub-contract case).
        user: { id: { not: job.createdByUserId } },
      },
      select: { userId: true, baseLat: true, baseLng: true, serviceRadiusKm: true },
    });

    const matched = candidates.filter((c) => {
      const distance = haversineKm(
        { lat: job.coarseLat, lng: job.coarseLng },
        { lat: c.baseLat as number, lng: c.baseLng as number },
      );
      return distance <= c.serviceRadiusKm;
    });

    if (matched.length === 0) return 0;

    await this.notifications.notifyMany(
      matched.map((c) => ({
        userId: c.userId,
        type: NotificationType.JOB_MATCH,
        data: {
          jobId: job.id,
          title: job.title,
          workType: job.workType,
          coarseLat: job.coarseLat,
          coarseLng: job.coarseLng,
        },
      })),
    );

    this.logger.log(`JOB_MATCH fan-out for job ${job.id}: ${matched.length} contractor(s).`);
    return matched.length;
  }
}
