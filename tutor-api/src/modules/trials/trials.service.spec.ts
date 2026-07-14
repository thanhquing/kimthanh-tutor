import { TrialsService } from './trials.service';
import { ErrorCode } from '../../common/errors/error-codes';

const now = new Date('2026-01-01T00:00:00Z');

const trial = {
  id: '01HYTRIAL00000000000000',
  parentProfileId: null,
  leadId: '01HYLEAD000000000000000',
  studentId: null,
  tutorProfileId: '01HYTUTOR00000000000000',
  subject: 'math',
  grade: '8',
  learningGoal: 'Improve algebra',
  teachingMode: 'online',
  preferredSchedule: 'Saturday morning',
  message: 'Please help',
  contactSnapshot: '{}',
  status: 'pending',
  version: 0,
  createdAt: now,
  respondedAt: null,
  expiresAt: now,
};

const classContract = {
  id: '01HYCLASS00000000000000',
  trialRequestId: trial.id,
  parentProfileId: null,
  studentId: null,
  tutorProfileId: trial.tutorProfileId,
  subject: trial.subject,
  status: 'trial_accepted',
  version: 0,
  startedAt: null,
  endedAt: null,
  createdAt: now,
  updatedAt: now,
};

describe('TrialsService', () => {
  it('creates a guest lead and a pending trial request', async () => {
    const tx = {
      trialRequest: { create: jest.fn().mockResolvedValue(trial) },
    };
    const prisma = {
      tutorProfile: { findFirst: jest.fn().mockResolvedValue({ id: trial.tutorProfileId }) },
      lead: { create: jest.fn().mockResolvedValue({ id: trial.leadId }) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const outbox = { emit: jest.fn() };
    const service = new TrialsService(prisma as any, outbox as any);

    const result = await service.create(undefined, {
      tutor_profile_id: trial.tutorProfileId,
      subject: trial.subject,
      grade: trial.grade!,
      learning_goal: trial.learningGoal!,
      teaching_mode: 'online',
      preferred_schedule: trial.preferredSchedule!,
      message: trial.message!,
      contact_name: 'Guest Parent',
      contact_phone: '0900000000',
    });

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactName: 'Guest Parent',
          contactPhone: '0900000000',
        }),
      }),
    );
    expect(tx.trialRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: trial.leadId,
          tutorProfileId: trial.tutorProfileId,
          subject: trial.subject,
        }),
      }),
    );
    expect(outbox.emit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: 'trial.created' }),
    );
    expect(result).toMatchObject({
      id: trial.id,
      status: 'pending',
      lead_id: trial.leadId,
      tutor_profile_id: trial.tutorProfileId,
    });
  });

  it('rejects blank guest contact fields after trimming', async () => {
    const prisma = {
      tutorProfile: { findFirst: jest.fn().mockResolvedValue({ id: trial.tutorProfileId }) },
      lead: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new TrialsService(prisma as any, {} as any);

    await expect(
      service.create(undefined, {
        tutor_profile_id: trial.tutorProfileId,
        subject: trial.subject,
        contact_name: '   ',
        contact_phone: '0900000000',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: { field: 'contact_name' },
    });
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it('accepts a pending trial and creates a class contract once', async () => {
    const tx = {
      trialRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...trial, status: 'accepted', version: 1 }),
      },
      classContract: { create: jest.fn().mockResolvedValue(classContract) },
      activationToken: { create: jest.fn() },
    };
    const prisma = {
      trialRequest: {
        findFirst: jest.fn().mockResolvedValue({ ...trial, classContract: null, lead: null }),
      },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const outbox = { emit: jest.fn() };
    const service = new TrialsService(prisma as any, outbox as any);

    const result = await service.accept(
      {
        userId: '01HYUSER0000000000000000',
        roles: ['tutor'],
        status: 'active',
        tutorProfileId: trial.tutorProfileId,
      } as any,
      trial.id,
    );

    expect(tx.trialRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: trial.id, version: 0, status: 'pending' },
        data: expect.objectContaining({ status: 'accepted' }),
      }),
    );
    expect(tx.classContract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trialRequestId: trial.id,
          tutorProfileId: trial.tutorProfileId,
          status: 'trial_accepted',
        }),
      }),
    );
    expect(result).toMatchObject({
      trial: { status: 'accepted', class_contract_id: classContract.id },
      class_contract: { id: classContract.id, status: 'trial_accepted' },
      activation_token: expect.any(String),
    });
    expect(tx.activationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: trial.leadId,
        trialRequestId: trial.id,
        tokenHash: expect.any(String),
        purpose: 'guest_trial_activation',
        expiresAt: expect.any(Date),
      }),
    });
    expect(outbox.emit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: 'trial.accepted',
        payload: expect.objectContaining({
          activation_token: expect.any(String),
        }),
      }),
    );
  });

  it('rejects accepting a non-pending trial', async () => {
    const prisma = {
      trialRequest: {
        findFirst: jest.fn().mockResolvedValue({
          ...trial,
          status: 'declined',
          classContract: null,
        }),
      },
    };
    const service = new TrialsService(prisma as any, {} as any);

    await expect(
      service.accept(
        {
          userId: '01HYUSER0000000000000000',
          roles: ['tutor'],
          status: 'active',
          tutorProfileId: trial.tutorProfileId,
        } as any,
        trial.id,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE_TRANSITION });
  });

  it('completes guest activation with a one-time hashed token', async () => {
    const token = 'raw-activation-token';
    const lead = {
      id: trial.leadId,
      contactName: 'Guest Parent',
      contactPhone: '0900000000',
      contactEmail: 'guest@example.test',
      status: 'new',
      trialRequests: [{ ...trial, status: 'accepted', classContract }],
    };
    const user = {
      id: 'user-1',
      phone: lead.contactPhone,
      email: lead.contactEmail,
      roles: ['parent'],
      status: 'pending_consent',
    };
    const parent = {
      id: 'parent-1',
      userId: user.id,
      displayName: lead.contactName,
    };
    const tx = {
      activationToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(user),
      },
      parentProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(parent),
      },
      lead: { update: jest.fn() },
      trialRequest: { updateMany: jest.fn() },
      classContract: {
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...classContract,
          parentProfileId: parent.id,
        }),
      },
    };
    const prisma = {
      activationToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'act-1',
          leadId: lead.id,
          trialRequestId: trial.id,
          purpose: 'guest_trial_activation',
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          lead,
        }),
      },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const service = new TrialsService(prisma as any, {} as any);

    const result = await service.completeActivation({ activation_token: token });

    expect(prisma.activationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String) },
      include: {
        lead: {
          include: { trialRequests: { include: { classContract: true } } },
        },
      },
    });
    expect(tx.activationToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'act-1',
        consumedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { consumedAt: expect.any(Date) },
    });
    expect(tx.lead.update).toHaveBeenCalledWith({
      where: { id: lead.id },
      data: { status: 'converted', convertedParentProfileId: parent.id },
    });
    expect(tx.trialRequest.updateMany).toHaveBeenCalledWith({
      where: { leadId: lead.id },
      data: { parentProfileId: parent.id, leadId: null },
    });
    expect(result).toMatchObject({
      user: { id: user.id, phone: user.phone, status: 'pending_consent' },
      parent_profile: { id: parent.id, display_name: lead.contactName },
      class_contract: { id: classContract.id, parent_profile_id: parent.id },
      consent_required: true,
    });
  });

  it('rejects a consumed activation token', async () => {
    const prisma = {
      activationToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'act-1',
          purpose: 'guest_trial_activation',
          consumedAt: now,
          expiresAt: new Date(Date.now() + 60_000),
          lead: { status: 'new', trialRequests: [] },
        }),
      },
    };
    const service = new TrialsService(prisma as any, {} as any);

    await expect(
      service.completeActivation({ activation_token: 'used-token' }),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });
});
