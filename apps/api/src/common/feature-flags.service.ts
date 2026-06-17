import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FeatureFlags {
  paymentsEnabled: boolean;
  messagingGroupVisible: boolean;
  profileRequireVerification: boolean;
  jobsMaxPhotos: number;
  aiJobDescriptionEnabled: boolean;
}

/**
 * Reads feature flags from env. In production back this with a DB table or a
 * provider (LaunchDarkly / ConfigCat) so flags can change without a redeploy.
 */
@Injectable()
export class FeatureFlagsService {
  constructor(private readonly config: ConfigService) {}

  get flags(): FeatureFlags {
    return {
      paymentsEnabled: this.bool('PAYMENTS_ENABLED', false),
      messagingGroupVisible: this.bool('MESSAGING_GROUP_VISIBLE', false),
      profileRequireVerification: this.bool('PROFILE_REQUIRE_VERIFICATION', false),
      jobsMaxPhotos: Number(this.config.get('JOBS_MAX_PHOTOS') ?? 4),
      aiJobDescriptionEnabled: this.bool('AI_JOB_DESCRIPTION_ENABLED', true),
    };
  }

  private bool(key: string, fallback: boolean): boolean {
    const raw = this.config.get<string>(key);
    if (raw === undefined) return fallback;
    return raw === 'true' || raw === '1';
  }
}
