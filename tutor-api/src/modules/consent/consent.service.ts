import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { newId } from '../../common/utils/id.util';
import { RecordConsentDto } from './dto/consent.dto';

@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // GET /legal/documents/active — bản Điều khoản/Chính sách đang hiệu lực.
  async activeDocuments() {
    const [terms, privacy] = await Promise.all([
      this.prisma.legalDocument.findFirst({
        where: { docType: 'terms', isActive: true },
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.legalDocument.findFirst({
        where: { docType: 'privacy', isActive: true },
        orderBy: { publishedAt: 'desc' },
      }),
    ]);
    return { terms: this.toDoc(terms), privacy: this.toDoc(privacy) };
  }

  private toDoc(
    d: {
      id: string;
      docType: string;
      version: string;
      title: string;
      contentUrl: string;
      checksum: string;
      publishedAt: Date;
    } | null,
  ) {
    if (!d) return null;
    return {
      id: d.id,
      doc_type: d.docType,
      version: d.version,
      title: d.title,
      content_url: d.contentUrl,
      checksum: d.checksum,
      published_at: d.publishedAt.toISOString(),
    };
  }

  // POST /legal/consents — ghi đồng ý, kích hoạt tài khoản (08-legal-consent).
  async recordConsent(
    userId: string,
    dto: RecordConsentDto,
    ctx: { ip?: string; userAgent?: string },
  ) {
    if (!dto.scroll_reached_bottom) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Phải cuộn hết nội dung trước khi đồng ý',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'User không tồn tại');
    }

    // Fail closed theo trạng thái (06-api-contract): chỉ user pending_consent
    // mới được kích hoạt. Đã active → idempotent. Suspended → cấm tự cởi khóa.
    if (user.status === 'active') {
      return { ok: true, user_status: 'active' };
    }
    if (user.status !== 'pending_consent') {
      throw new AppException(
        ErrorCode.FORBIDDEN_ROLE,
        `Không thể ghi consent ở trạng thái ${user.status}`,
      );
    }

    // Xác minh 2 văn bản tồn tại, đang hiệu lực, đúng loại (tránh P2003 → 500
    // và chống ghi consent vào bản đã hết hiệu lực).
    const [terms, privacy] = await Promise.all([
      this.prisma.legalDocument.findFirst({
        where: { id: dto.terms_document_id, docType: 'terms', isActive: true },
        select: { id: true },
      }),
      this.prisma.legalDocument.findFirst({
        where: {
          id: dto.privacy_document_id,
          docType: 'privacy',
          isActive: true,
        },
        select: { id: true },
      }),
    ]);
    if (!terms) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Văn bản Điều khoản không hợp lệ hoặc đã hết hiệu lực',
      );
    }
    if (!privacy) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Văn bản Chính sách không hợp lệ hoặc đã hết hiệu lực',
      );
    }

    const storeIp = this.config.get<boolean>('consent.storeIp');
    const storeUa = this.config.get<boolean>('consent.storeUserAgent');
    const roleAtAcceptance = user.roles[0] ?? 'guest';

    await this.prisma.$transaction([
      this.prisma.legalConsent.create({
        data: {
          id: newId(),
          userId,
          roleAtAcceptance,
          termsDocumentId: dto.terms_document_id,
          privacyDocumentId: dto.privacy_document_id,
          scrollReachedBottom: dto.scroll_reached_bottom,
          consentMethod: dto.consent_method,
          ipAddress: storeIp ? ctx.ip ?? null : null,
          userAgent: storeUa ? ctx.userAgent ?? null : null,
        },
      }),
      // Guard trạng thái ngay trong UPDATE: chỉ đổi khi vẫn pending_consent.
      this.prisma.user.updateMany({
        where: { id: userId, status: 'pending_consent' },
        data: { status: 'active' },
      }),
    ]);

    return { ok: true, user_status: 'active' };
  }
}
