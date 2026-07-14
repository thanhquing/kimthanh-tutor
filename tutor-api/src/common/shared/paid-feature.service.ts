import { Injectable } from '@nestjs/common';
import { PaidFeature } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaidFeatureService {
  constructor(private readonly prisma: PrismaService) {}

  async overrideState(
    userId: string,
    feature: PaidFeature,
  ): Promise<boolean | null> {
    const override = await this.prisma.paidFeatureOverride.findUnique({
      where: { userId_feature: { userId, feature } },
      select: { enabled: true, expiresAt: true },
    });
    if (!override) return null;
    if (override.expiresAt && override.expiresAt <= new Date()) return null;
    return override.enabled;
  }

  async isDisabled(userId: string, feature: PaidFeature): Promise<boolean> {
    return (await this.overrideState(userId, feature)) === false;
  }
}
