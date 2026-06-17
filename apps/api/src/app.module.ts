import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { PushModule } from './push/push.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContractorsModule } from './contractors/contractors.module';
import { MediaModule } from './media/media.module';
import { JobsModule } from './jobs/jobs.module';
import { BidsModule } from './bids/bids.module';
import { MessagesModule } from './messages/messages.module';
import { ReviewsModule } from './reviews/reviews.module';
import { DevicesModule } from './devices/devices.module';
import { AdminModule } from './admin/admin.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limit: 120 requests / minute / IP. Override per-route with
    // @Throttle on sensitive endpoints. For multi-instance deployments, back
    // this with Redis via @nest-lab/throttler-storage-redis.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    CommonModule,
    AuditModule,
    PushModule,
    RealtimeModule,
    NotificationsModule,
    PaymentsModule,
    AuthModule,
    UsersModule,
    ContractorsModule,
    MediaModule,
    JobsModule,
    BidsModule,
    MessagesModule,
    ReviewsModule,
    DevicesModule,
    AdminModule,
    GeocodingModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
