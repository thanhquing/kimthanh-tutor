import { Injectable } from '@nestjs/common';
import { SubscriptionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';
import { PaidFeatureService } from './paid-feature.service';

export interface UnlockState {
  unlocked: boolean;
  via: 'single_unlock' | 'vip_subscription' | null;
}

// Kiểm tra quyền truy cập trả phí (07-payments): mở khóa hồ sơ (đơn lẻ / VIP)
// và gói định kỳ (tracking theo học sinh, QR gia sư). Dùng chung mọi module.
@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paidFeatures: PaidFeatureService,
  ) {}

  // Còn hiệu lực = active và (vĩnh viễn hoặc chưa hết hạn).
  private notExpired(now: Date) {
    return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
  }

  private subNotExpired(now: Date) {
    return { OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] };
  }

  async profileUnlockState(
    parentProfileId: string,
    parentUserId: string,
    tutorProfileId: string,
  ): Promise<UnlockState> {
    const now = new Date();

    const singleOverride = await this.paidFeatures.overrideState(
      parentUserId,
      'single_unlock',
    );
    if (singleOverride !== false) {
      const single = await this.prisma.profileUnlock.findFirst({
        where: {
          parentProfileId,
          tutorProfileId,
          status: 'active',
          ...this.notExpired(now),
        },
        select: { id: true },
      });
      if (single) return { unlocked: true, via: 'single_unlock' };
    }

    // VIP mở khóa mọi hồ sơ trong thời hạn gói.
    const vipOverride = await this.paidFeatures.overrideState(
      parentUserId,
      'parent_vip',
    );
    if (vipOverride === true) return { unlocked: true, via: 'vip_subscription' };
    if (vipOverride === false) return { unlocked: false, via: null };

    const vip = await this.hasActiveSubscription(parentUserId, 'parent_vip_unlock');
    if (vip) return { unlocked: true, via: 'vip_subscription' };

    return { unlocked: false, via: null };
  }

  async hasActiveSubscription(
    userId: string,
    type: SubscriptionType,
    scopeRefId?: string,
  ): Promise<boolean> {
    const now = new Date();
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        type,
        status: 'active',
        ...(scopeRefId !== undefined ? { scopeRefId } : {}),
        ...this.subNotExpired(now),
      },
      select: { id: true },
    });
    return sub !== null;
  }

  async assertProfileUnlocked(
    parentProfileId: string,
    parentUserId: string,
    tutorProfileId: string,
  ): Promise<void> {
    const state = await this.profileUnlockState(
      parentProfileId,
      parentUserId,
      tutorProfileId,
    );
    if (!state.unlocked) {
      throw new AppException(
        ErrorCode.UNLOCK_REQUIRED,
        'Cần mở khóa hồ sơ hoặc gói VIP để xem chi tiết',
      );
    }
  }

  async assertTracking(userId: string, studentId: string): Promise<void> {
    const override = await this.paidFeatures.overrideState(
      userId,
      'parent_tracking',
    );
    if (override === true) return;
    if (override === false) {
      throw new AppException(
        ErrorCode.SUBSCRIPTION_EXPIRED,
        'Tính năng theo dõi học tập đang bị tắt cho user này',
      );
    }

    const now = new Date();
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        type: 'parent_tracking',
        scopeRefId: studentId,
      },
      select: { status: true, currentPeriodEnd: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!sub) {
      throw new AppException(
        ErrorCode.PAYMENT_REQUIRED,
        'Cần gói theo dõi học tập',
      );
    }
    const expired = sub.currentPeriodEnd !== null && sub.currentPeriodEnd <= now;
    if (sub.status !== 'active' || expired) {
      throw new AppException(
        ErrorCode.SUBSCRIPTION_EXPIRED,
        'Cần gói theo dõi còn hiệu lực cho học sinh này',
      );
    }
  }

  async assertTutorQr(userId: string): Promise<void> {
    const override = await this.paidFeatures.overrideState(userId, 'tutor_qr');
    if (override === true) return;
    if (override === false) {
      throw new AppException(
        ErrorCode.SUBSCRIPTION_EXPIRED,
        'Tính năng QR đang bị tắt cho user này',
      );
    }

    const ok = await this.hasActiveSubscription(userId, 'tutor_qr');
    if (!ok) {
      throw new AppException(
        ErrorCode.SUBSCRIPTION_EXPIRED,
        'Cần gói QR còn hiệu lực để tạo mã thanh toán',
      );
    }
  }
}
