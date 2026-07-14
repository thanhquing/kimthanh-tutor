import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { newId } from '../utils/id.util';
import { sha256 } from '../utils/hash.util';
import { Db } from './db.type';

// Ghi nhật ký kiểm toán cho hành động admin/nhạy cảm (04-roles, 13-security).
// Lưu hash before/after thay vì bản gốc để không nhân bản PII.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    db: Db,
    a: {
      actorUserId?: string;
      actorRole?: string;
      action: string;
      entityType: string;
      entityId: string;
      before?: unknown;
      after?: unknown;
      ip?: string;
    },
  ): Promise<void> {
    await db.auditLog.create({
      data: {
        id: newId(),
        actorUserId: a.actorUserId ?? null,
        actorRole: a.actorRole ?? null,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        beforeHash: a.before !== undefined ? sha256(JSON.stringify(a.before)) : null,
        afterHash: a.after !== undefined ? sha256(JSON.stringify(a.after)) : null,
        ipAddress: a.ip ?? null,
      },
    });
  }

  logStandalone(a: {
    actorUserId?: string;
    actorRole?: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
  }): Promise<void> {
    return this.log(this.prisma, a);
  }
}
