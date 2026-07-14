import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

// Các model có soft delete (cột deletedAt). Mọi truy vấn đọc mặc định loại bỏ
// bản ghi đã xóa tại MỘT chỗ (middleware), thay vì bắt từng service tự nhớ.
// User KHÔNG nằm ở đây: auth cần thấy user deleted để CHẶN (không "hồi sinh").
const SOFT_DELETE_MODELS = new Set<Prisma.ModelName>([
  'ParentProfile',
  'Student',
  'TutorProfile',
  'LessonLog',
]);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    this.installSoftDeleteFilter();
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  // Choke-point soft delete: tự chèn `deletedAt: null` vào các truy vấn đọc.
  // findUnique/findUniqueOrThrow được đổi sang findFirst để có thể lọc thêm
  // điều kiện (findUnique không nhận field ngoài khóa unique).
  private installSoftDeleteFilter(): void {
    this.$use(async (params, next) => {
      if (params.model && SOFT_DELETE_MODELS.has(params.model)) {
        if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
          params.action =
            params.action === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
          params.args = params.args ?? {};
          params.args.where = { ...params.args.where, deletedAt: null };
        } else if (
          params.action === 'findFirst' ||
          params.action === 'findFirstOrThrow' ||
          params.action === 'findMany' ||
          params.action === 'count' ||
          params.action === 'aggregate'
        ) {
          params.args = params.args ?? {};
          // Chỉ thêm nếu caller chưa chủ động chỉ định deletedAt (cho phép
          // truy vấn bản ghi đã xóa khi thực sự cần, ví dụ khôi phục).
          if (params.args.where?.deletedAt === undefined) {
            params.args.where = { ...params.args.where, deletedAt: null };
          }
        }
      }
      return next(params);
    });
  }
}
