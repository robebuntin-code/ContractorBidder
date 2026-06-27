import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ContractorProfile, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { MediaService } from '../media/media.service';
import { UpsertContractorProfileDto } from './dto/contractor-profile.dto';

@Injectable()
export class ContractorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  /** Create-or-update the caller's own contractor profile (idempotent upsert). */
  async upsertMine(user: AuthUser, dto: UpsertContractorProfileDto, req?: Request) {
    if (user.role !== Role.CONTRACTOR) {
      throw new ForbiddenException({
        code: 'CONTRACTOR_ONLY',
        message: 'Only contractors can manage a contractor profile.',
      });
    }

    const profile = await this.prisma.contractorProfile.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId, ...this.toData(dto) },
      update: this.toData(dto),
    });
    return this.withResolvedMedia(profile, req);
  }

  /** Authenticated contractor's own editable profile (includes service area coordinates). */
  async getMine(user: AuthUser, req?: Request) {
    if (user.role !== Role.CONTRACTOR) {
      throw new ForbiddenException({
        code: 'CONTRACTOR_ONLY',
        message: 'Only contractors can manage a contractor profile.',
      });
    }

    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId: user.userId },
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    });
    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: 'Contractor profile not found.',
      });
    }

    const resolved = this.withResolvedMedia(profile, req);
    return {
      userId: resolved.userId,
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      phone: profile.user.phone,
      companyName: resolved.companyName,
      logoUrl: resolved.logoUrl,
      description: resolved.description,
      businessAddress: resolved.businessAddress,
      serviceTypes: resolved.serviceTypes,
      serviceRadiusKm: resolved.serviceRadiusKm,
      baseLat: resolved.baseLat,
      baseLng: resolved.baseLng,
      googleReviewsUrl: resolved.googleReviewsUrl,
      licenseNumber: resolved.licenseNumber,
      ratingAgg: resolved.ratingAgg,
      ratingCount: resolved.ratingCount,
    };
  }

  /** Public profile by user id — includes contact info shown after a job is awarded. */
  async getPublic(userId: string, req?: Request) {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    });
    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: 'Contractor profile not found.',
      });
    }
    return this.toPublic(profile, profile.user, req);
  }

  private withResolvedMedia(profile: ContractorProfile, req?: Request) {
    return {
      ...profile,
      logoUrl: this.resolveLogoUrl(profile.logoUrl, req),
    };
  }

  private resolveLogoUrl(logoUrl: string | null, req?: Request): string | null {
    if (!logoUrl?.trim()) return logoUrl;
    return this.media.resolvePublicUrl(logoUrl, req);
  }

  private toData(dto: UpsertContractorProfileDto) {
    // Only assign provided keys so PATCH doesn't clobber fields with undefined.
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) data[key] = value;
    }
    if (dto.logoUrl) {
      data.logoUrl = this.media.normalizeStoredUrl(dto.logoUrl);
    }
    if (dto.insuranceDocUrl) {
      data.insuranceDocUrl = this.media.normalizeStoredUrl(dto.insuranceDocUrl);
    }
    return data;
  }

  private toPublic(
    profile: ContractorProfile,
    user: { firstName: string; lastName: string; phone: string | null },
    req?: Request,
  ) {
    return {
      userId: profile.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      companyName: profile.companyName,
      logoUrl: this.resolveLogoUrl(profile.logoUrl, req),
      description: profile.description,
      businessAddress: profile.businessAddress,
      serviceTypes: profile.serviceTypes,
      serviceRadiusKm: profile.serviceRadiusKm,
      googleReviewsUrl: profile.googleReviewsUrl,
      licenseNumber: profile.licenseNumber,
      ratingAgg: profile.ratingAgg,
      ratingCount: profile.ratingCount,
      // insuranceDocUrl is intentionally omitted from public view.
    };
  }
}
