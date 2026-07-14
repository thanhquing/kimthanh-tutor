import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { newId } from '../utils/id.util';
import { Db } from './db.type';

// Outbox: side-effect (đồng bộ search, tích hợp ngoài) KHÔNG chạy đồng bộ trong
// request — chỉ ghi sự kiện, worker xử lý sau (06-api-contract, 15-architecture).
@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async emit(
    db: Db,
    e: {
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await db.outboxEvent.create({
      data: {
        id: newId(),
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        eventType: e.eventType,
        payload: e.payload as object,
      },
    });
  }

  // Tiện dụng khi không nằm trong transaction.
  emitStandalone(e: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    return this.emit(this.prisma, e);
  }
}
