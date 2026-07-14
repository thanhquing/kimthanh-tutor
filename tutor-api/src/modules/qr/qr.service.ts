import { Injectable } from '@nestjs/common';
import { TutorPaymentQrRecord } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { newId } from '../../common/utils/id.util';
import { vietQrImageUrl } from '../../common/payments/vietqr.util';
import { AccessService } from '../../common/shared/access.service';
import { QrListQueryDto, QrRecordDto } from './dto/qr.dto';

@Injectable()
export class QrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async create(userId: string, dto: QrRecordDto) {
    await this.access.assertTutorQr(userId);
    const tutor = await this.requireTutor(userId);
    const payout = await this.prisma.tutorPayoutAccount.findFirst({
      where: { id: dto.payout_account_id, tutorProfileId: tutor.id },
    });
    if (!payout) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tài khoản nhận tiền của gia sư',
      );
    }

    if (dto.class_contract_id) {
      const klass = await this.prisma.classContract.findFirst({
        where: { id: dto.class_contract_id, tutorProfileId: tutor.id },
        select: { id: true },
      });
      if (!klass) {
        throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không tìm thấy lớp');
      }
    }

    const id = newId();
    const description = dto.description?.trim() || `Hoc phi ${id.slice(-8)}`;
    const qrUrl = vietQrImageUrl({
      bankCode: payout.bankCode,
      accountNumber: payout.accountNumber,
      accountName: payout.accountHolder,
      amount: dto.amount,
      addInfo: description,
    });
    const record = await this.prisma.tutorPaymentQrRecord.create({
      data: {
        id,
        tutorProfileId: tutor.id,
        classContractId: dto.class_contract_id ?? null,
        payoutAccountId: payout.id,
        amount: BigInt(dto.amount),
        description,
        qrUrl,
        paymentLink: qrUrl,
      },
    });
    return this.toRecord(record);
  }

  async list(userId: string, query: QrListQueryDto) {
    const tutor = await this.requireTutor(userId);
    const items = await this.prisma.tutorPaymentQrRecord.findMany({
      where: {
        tutorProfileId: tutor.id,
        ...(query.class_contract_id
          ? { classContractId: query.class_contract_id }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return { items: items.map((r) => this.toRecord(r)) };
  }

  async markCollected(userId: string, id: string) {
    const tutor = await this.requireTutor(userId);
    const record = await this.prisma.tutorPaymentQrRecord.findFirst({
      where: { id, tutorProfileId: tutor.id },
    });
    if (!record) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy bản ghi QR',
      );
    }
    if (record.collectionStatus === 'marked_collected') {
      return this.toRecord(record);
    }
    if (record.collectionStatus === 'cancelled') {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        'QR đã hủy không thể đánh dấu đã thu',
      );
    }
    const updated = await this.prisma.tutorPaymentQrRecord.update({
      where: { id },
      data: {
        collectionStatus: 'marked_collected',
        markedCollectedAt: new Date(),
      },
    });
    return this.toRecord(updated);
  }

  private async requireTutor(userId: string) {
    const tutor = await this.prisma.tutorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!tutor) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Chưa có hồ sơ gia sư');
    }
    return tutor;
  }

  private toRecord(r: TutorPaymentQrRecord) {
    return {
      id: r.id,
      tutor_profile_id: r.tutorProfileId,
      class_contract_id: r.classContractId,
      payout_account_id: r.payoutAccountId,
      amount: Number(r.amount),
      description: r.description,
      transfer_content: r.description,
      qr_url: r.qrUrl,
      payment_link: r.paymentLink,
      collection_status: r.collectionStatus,
      marked_collected_at: r.markedCollectedAt?.toISOString() ?? null,
      created_at: r.createdAt.toISOString(),
    };
  }
}
