import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { newId } from '../utils/id.util';
import { Db } from './db.type';

// Tạo thông báo in-app (đọc được ngay qua GET /notifications) và ghi outbox cho
// các kênh ngoài (sms/email/push) để worker gửi sau (09-notification-flows).
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(
    db: Db,
    n: {
      recipientUserId: string;
      type: string;
      payload: Record<string, unknown>;
      externalChannels?: ('sms' | 'email' | 'push')[];
    },
  ): Promise<void> {
    await db.notification.create({
      data: {
        id: newId(),
        recipientUserId: n.recipientUserId,
        channel: 'in_app',
        type: n.type,
        payload: n.payload as object,
        status: 'queued',
      },
    });

    for (const channel of n.externalChannels ?? []) {
      await db.outboxEvent.create({
        data: {
          id: newId(),
          aggregateType: 'notification',
          aggregateId: n.recipientUserId,
          eventType: `notify.${channel}.${n.type}`,
          payload: { channel, type: n.type, ...n.payload } as object,
        },
      });
    }
  }

  notifyStandalone(n: {
    recipientUserId: string;
    type: string;
    payload: Record<string, unknown>;
    externalChannels?: ('sms' | 'email' | 'push')[];
  }): Promise<void> {
    return this.notify(this.prisma, n);
  }
}
