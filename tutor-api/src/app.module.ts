import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { SharedModule } from './common/shared/shared.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';

// Modules nghiệp vụ
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConsentModule } from './modules/consent/consent.module';
import { SearchModule } from './modules/search/search.module';
import { TutorsModule } from './modules/tutors/tutors.module';
import { ParentsModule } from './modules/parents/parents.module';
import { BillingModule } from './modules/billing/billing.module';
import { TrialsModule } from './modules/trials/trials.module';
import { ClassesModule } from './modules/classes/classes.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { QrModule } from './modules/qr/qr.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    // Rate limit toàn cục (13-security). Nhóm nhạy cảm (OTP) siết chặt hơn
    // bằng @Throttle tại endpoint.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
      }),
    }),
    PrismaModule,
    SharedModule,
    HealthModule,
    AuthModule,
    ConsentModule,
    SearchModule,
    TutorsModule,
    ParentsModule,
    BillingModule,
    TrialsModule,
    ClassesModule,
    DashboardModule,
    ReviewsModule,
    QrModule,
    NotificationsModule,
    AdminModule,
  ],
  providers: [
    // Thứ tự quan trọng: throttler chạy trước, rồi tới xác thực.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
