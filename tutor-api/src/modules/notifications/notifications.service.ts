import { Injectable } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import {
  buildKeyset,
  clampLimit,
  decodeCursor,
  encodeCursor,
  KeysetResult,
} from '../../common/pagination/keyset';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

type NotificationItem = ReturnType<NotificationsService['toItem']>;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<KeysetResult<NotificationItem>> {
    const limit = clampLimit(query.limit);
    const where = this.cursorWhere(userId, query.cursor);
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (n) =>
      encodeCursor(n.createdAt.toISOString(), n.id),
    );
    return {
      items: page.items.map((n) => this.toItem(n)),
      next_cursor: page.next_cursor,
    };
  }

  async markRead(userId: string, id: string) {
    const found = await this.prisma.notification.findFirst({
      where: { id, recipientUserId: userId },
    });
    if (!found) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy thông báo',
      );
    }
    if (found.status === 'read') {
      return { ok: true, notification: this.toItem(found) };
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { status: 'read', readAt: new Date() },
    });
    return { ok: true, notification: this.toItem(updated) };
  }

  private cursorWhere(userId: string, cursor?: string) {
    const where: {
      recipientUserId: string;
      OR?: ({ createdAt: { lt: Date } } | { createdAt: Date; id: { lt: string } })[];
    } = { recipientUserId: userId };
    const decoded = decodeCursor(cursor);
    if (cursor && !decoded) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
    }
    if (!decoded) return where;
    const [value, id] = decoded;
    if (typeof value !== 'string') {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
    }
    const createdAt = new Date(value);
    if (Number.isNaN(createdAt.getTime())) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
    }
    where.OR = [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }];
    return where;
  }

  private toItem(n: Notification) {
    return {
      id: n.id,
      channel: n.channel,
      type: n.type,
      payload: n.payload,
      status: n.status,
      created_at: n.createdAt.toISOString(),
      read_at: n.readAt?.toISOString() ?? null,
    };
  }
}
