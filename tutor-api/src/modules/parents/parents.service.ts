import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { newId } from '../../common/utils/id.util';
import { StudentDto, UpdateStudentDto, UpsertParentDto } from './dto/parent.dto';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  // POST /parents/me — bootstrap: tạo hồ sơ phụ huynh + cấp vai trò 'parent'.
  // Đây là điểm gán vai trò (guard đọc roles từ DB nên có hiệu lực ngay).
  async bootstrap(userId: string, dto: UpsertParentDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'User không tồn tại');
    }

    const existing = await this.prisma.parentProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      // Idempotent: đã là phụ huynh → cập nhật thông tin nếu có.
      return this.updateMe(userId, dto);
    }

    const displayName =
      dto.display_name?.trim() || `Phụ huynh ${user.phone ?? user.email ?? user.id}`;
    const profile = await this.prisma.$transaction(async (tx) => {
      const created = await tx.parentProfile.create({
        data: { id: newId(), userId, displayName },
      });
      if (!user.roles.includes('parent')) {
        await tx.user.update({
          where: { id: userId },
          data: { roles: { set: [...user.roles, 'parent'] } },
        });
      }
      if (dto.email) {
        await tx.user.update({
          where: { id: userId },
          data: { email: dto.email },
        });
      }
      return created;
    });

    return this.toParent(profile, dto.email ?? user.email ?? null);
  }

  async getMe(userId: string) {
    const profile = await this.requireProfile(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return this.toParent(profile, user?.email ?? null);
  }

  async updateMe(userId: string, dto: UpsertParentDto) {
    await this.requireProfile(userId);
    const displayName =
      dto.display_name !== undefined
        ? this.requiredTrim(dto.display_name, 'display_name')
        : undefined;
    const profile = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.parentProfile.update({
        where: { userId },
        data: {
          ...(dto.display_name !== undefined
            ? { displayName }
            : {}),
        },
      });
      if (dto.email !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { email: dto.email },
        });
      }
      return updated;
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return this.toParent(profile, user?.email ?? null);
  }

  async listStudents(userId: string) {
    const profile = await this.requireProfile(userId);
    const students = await this.prisma.student.findMany({
      where: { parentProfileId: profile.id },
      orderBy: { createdAt: 'asc' },
    });
    return { items: students.map((s) => this.toStudent(s)) };
  }

  async addStudent(userId: string, dto: StudentDto) {
    const profile = await this.requireProfile(userId);
    const name = this.requiredTrim(dto.name, 'name');
    const grade = this.requiredTrim(dto.grade, 'grade');
    const student = await this.prisma.student.create({
      data: {
        id: newId(),
        parentProfileId: profile.id,
        name,
        grade,
        learningGoals: this.optionalTrim(dto.learning_goals),
      },
    });
    return this.toStudent(student);
  }

  async updateStudent(userId: string, id: string, dto: UpdateStudentDto) {
    const profile = await this.requireProfile(userId);
    await this.requireStudent(profile.id, id);
    const name =
      dto.name !== undefined ? this.requiredTrim(dto.name, 'name') : undefined;
    const grade =
      dto.grade !== undefined ? this.requiredTrim(dto.grade, 'grade') : undefined;
    const student = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name } : {}),
        ...(dto.grade !== undefined ? { grade } : {}),
        ...(dto.learning_goals !== undefined
          ? { learningGoals: this.optionalTrim(dto.learning_goals) }
          : {}),
      },
    });
    return this.toStudent(student);
  }

  async removeStudent(userId: string, id: string) {
    const profile = await this.requireProfile(userId);
    await this.requireStudent(profile.id, id);
    await this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  // ---- helpers (ownership, fail closed) ----
  private async requireProfile(userId: string) {
    const profile = await this.prisma.parentProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Chưa có hồ sơ phụ huynh',
      );
    }
    return profile;
  }

  private async requireStudent(parentProfileId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, parentProfileId },
      select: { id: true },
    });
    if (!student) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy học sinh của bạn',
      );
    }
    return student;
  }

  private requiredTrim(value: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `${field} không được để trống`,
        { field },
      );
    }
    return trimmed;
  }

  private optionalTrim(value?: string): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private toParent(p: {
    id: string;
    displayName: string;
    status: string;
    createdAt: Date;
  }, email?: string | null) {
    return {
      id: p.id,
      display_name: p.displayName,
      email: email ?? null,
      status: p.status,
      created_at: p.createdAt.toISOString(),
    };
  }

  private toStudent(s: {
    id: string;
    name: string;
    grade: string;
    learningGoals: string | null;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: s.id,
      name: s.name,
      grade: s.grade,
      learning_goals: s.learningGoals,
      status: s.status,
      created_at: s.createdAt.toISOString(),
    };
  }
}
