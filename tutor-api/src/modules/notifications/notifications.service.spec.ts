import { NotificationsService } from './notifications.service';
import { encodeCursor } from '../../common/pagination/keyset';

const first = {
  id: 'n2',
  recipientUserId: 'user-1',
  channel: 'in_app',
  type: 'trial.accepted',
  payload: { trial_id: 't1' },
  status: 'queued',
  retryCount: 0,
  createdAt: new Date('2026-01-02T00:00:00Z'),
  readAt: null,
};

const second = {
  ...first,
  id: 'n1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('NotificationsService', () => {
  it('lists notifications with keyset cursor output', async () => {
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([first, second]),
      },
    };
    const service = new NotificationsService(prisma as any);

    const result = await service.list('user-1', { limit: '1' });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientUserId: 'user-1' },
        take: 2,
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'n2', type: 'trial.accepted' }),
    ]);
    expect(result.next_cursor).toBe(
      encodeCursor(first.createdAt.toISOString(), first.id),
    );
  });

  it('marks unread notification as read for the owner', async () => {
    const updated = { ...first, status: 'read', readAt: new Date('2026-01-03T00:00:00Z') };
    const prisma = {
      notification: {
        findFirst: jest.fn().mockResolvedValue(first),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const service = new NotificationsService(prisma as any);

    const result = await service.markRead('user-1', first.id);

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: first.id },
      data: expect.objectContaining({ status: 'read' }),
    });
    expect(result).toMatchObject({
      ok: true,
      notification: { id: first.id, status: 'read' },
    });
  });
});
