import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import {
  AvailabilityDto,
  MediaUploadDto,
  PayoutAccountDto,
  TutorProfileDto,
} from "../tutors/dto/tutor.dto";
import { QrRecordDto } from "../qr/dto/qr.dto";
import { ReviewDto } from "../reviews/dto/review.dto";
import {
  AdminAuditLogsQueryDto,
  AdminSystemLogsQueryDto,
  AdminUserStatusDto,
  AdminPaymentsQueryDto,
  ModerateMediaDto,
  PaidFeatureOverrideDto,
  PlatformPaymentAccountDto,
  PricingDto,
  RefundDto,
} from "../admin/dto/admin.dto";
import { SearchQueryDto } from "../search/dto/search-query.dto";
import { AdminPasswordLoginDto } from "../auth/dto/auth.dto";
import { DeclineTrialDto, TrialActionDto, TrialMineQueryDto } from "../trials/dto/trial.dto";
import { ClassesMineQueryDto, LessonLogDto, TransitionDto, UpdateLessonLogDto } from "../classes/dto/class.dto";

function errorsFor<T extends object>(Cls: new () => T, payload: object) {
  const instance = plainToInstance(Cls, payload);
  return validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe("DTO validation contracts", () => {
  it("validates and normalizes PII payout-account input", () => {
    const valid = plainToInstance(PayoutAccountDto, {
      bank_code: " 970436 ",
      account_number: "1234 567-890",
      account_holder: " Nguyễn   Thị Linh ",
      is_default: true,
    });
    expect(validateSync(valid)).toEqual([]);
    expect(valid).toMatchObject({
      bank_code: "970436",
      account_number: "1234567890",
      account_holder: "Nguyễn Thị Linh",
    });
    expect(errorsFor(PayoutAccountDto, {
      bank_code: "VCB",
      account_number: "abc",
      account_holder: "",
      is_default: "true",
    })).not.toEqual([]);
  });

  it("validates class filters and optimistic transition input", () => {
    expect(errorsFor(ClassesMineQueryDto, { status: "ended" })).toHaveLength(1);
    expect(errorsFor(ClassesMineQueryDto, { role: "tutor", status: "paused", limit: "20" })).toEqual([]);
    expect(errorsFor(TransitionDto, { to: "completed" })).toHaveLength(1);
    expect(errorsFor(TransitionDto, { to: "paused", expected_version: -1 })).toHaveLength(1);
    expect(errorsFor(TransitionDto, { to: "paused", expected_version: 0 })).toEqual([]);
  });
  it("validates lesson log lengths, datetime and canonical absorption values", () => {
    expect(errorsFor(LessonLogDto, { subject: "Toán", absorption_level: "excellent" })).toHaveLength(1);
    expect(errorsFor(LessonLogDto, { subject: "x".repeat(81), absorption_level: "good" })).toHaveLength(1);
    expect(errorsFor(LessonLogDto, { lesson_at: "not-a-date", subject: "Toán", absorption_level: "normal" })).toHaveLength(1);
    expect(errorsFor(LessonLogDto, { lesson_at: "2026-07-19T12:30:00.000Z", subject: "Toán", absorption_level: "needs_review", tutor_note: "Cần ôn lại" })).toEqual([]);
    expect(errorsFor(UpdateLessonLogDto, { content: "x".repeat(4001) })).toHaveLength(1);
    expect(errorsFor(UpdateLessonLogDto, { content: "", tutor_note: "" })).toEqual([]);
  });
  it("validates trial filters, expected version and non-empty decline reason", () => {
    expect(errorsFor(TrialMineQueryDto, { status: "unknown" })).toHaveLength(1);
    expect(errorsFor(TrialMineQueryDto, { status: "cancelled", limit: "20" })).toEqual([]);
    expect(errorsFor(TrialActionDto, { expected_version: -1 })).toHaveLength(1);
    expect(errorsFor(TrialActionDto, { expected_version: 0 })).toEqual([]);
    expect(errorsFor(DeclineTrialDto, { reason: "" })).toHaveLength(1);
    expect(errorsFor(DeclineTrialDto, { reason: "Trùng lịch", expected_version: 2 })).toEqual([]);
  });
  it("requires a valid admin email and a 12-128 character password", () => {
    expect(errorsFor(AdminPasswordLoginDto, { email: "invalid", password: "short" })).not.toEqual([]);
    expect(errorsFor(AdminPasswordLoginDto, { email: "admin@example.test", password: "correct-password" })).toEqual([]);
  });
  it("coerces numeric form values for tutor profile inputs", () => {
    const instance = plainToInstance(TutorProfileDto, {
      display_name: "Tutor One",
      student_year: "3",
      exam_score: "27.5",
      gpa: "8.75",
      expected_fee_min: "100000",
      expected_fee_max: "150000",
      grade_levels: ["6"],
    });

    expect(validateSync(instance)).toEqual([]);
    expect(instance).toMatchObject({
      student_year: 3,
      exam_score: 27.5,
      gpa: 8.75,
      expected_fee_min: 100000,
      expected_fee_max: 150000,
      grade_levels: [6],
    });
  });

  it("limits tutor grade levels to Vietnamese K-12 grades", () => {
    expect(
      errorsFor(TutorProfileDto, {
        display_name: "Tutor One",
        grade_levels: [0],
      }),
    ).toHaveLength(1);

    expect(
      errorsFor(TutorProfileDto, {
        display_name: "Tutor One",
        grade_levels: [13],
      }),
    ).toHaveLength(1);

    expect(
      errorsFor(TutorProfileDto, {
        display_name: "Tutor One",
        grade_levels: [1, 12],
      }),
    ).toEqual([]);
  });

  it("limits search grade level filters to Vietnamese K-12 grades", () => {
    expect(errorsFor(SearchQueryDto, { grade_level: "0" })).toHaveLength(1);
    expect(errorsFor(SearchQueryDto, { grade_level: "13" })).toHaveLength(1);

    const query = plainToInstance(SearchQueryDto, { grade_level: "6" });
    expect(validateSync(query)).toEqual([]);
    expect(query.grade_level).toBe(6);
  });

  it("limits search score filters to the same ranges as tutor profiles", () => {
    expect(errorsFor(SearchQueryDto, { min_exam_score: "31" })).toHaveLength(1);
    expect(errorsFor(SearchQueryDto, { min_gpa: "11" })).toHaveLength(1);

    const query = plainToInstance(SearchQueryDto, {
      min_exam_score: "27.5",
      min_gpa: "8.75",
    });
    expect(validateSync(query)).toEqual([]);
    expect(query).toMatchObject({
      min_exam_score: 27.5,
      min_gpa: 8.75,
    });
  });

  it("requires availability time in HH:mm format", () => {
    expect(
      errorsFor(AvailabilityDto, {
        day_of_week: 1,
        start_time: "9:00",
        end_time: "10:00",
      }),
    ).toHaveLength(1);

    expect(
      errorsFor(AvailabilityDto, {
        day_of_week: 1,
        start_time: "09:00",
        end_time: "10:00",
      }),
    ).toEqual([]);
  });

  it("coerces numeric form values for payment-like DTOs", () => {
    const qr = plainToInstance(QrRecordDto, {
      amount: "250000",
      payout_account_id: "01HYPAYOUT000000000000",
    });
    const review = plainToInstance(ReviewDto, { rating: "5" });
    const refund = plainToInstance(RefundDto, {
      payment_id: "01HYPAYMENT000000000000",
      reason: "duplicate transfer",
      amount: "49000",
    });
    const media = plainToInstance(MediaUploadDto, {
      kind: "avatar",
      content_type: "image/png",
      size: "1024",
    });

    expect(validateSync(qr)).toEqual([]);
    expect(validateSync(review)).toEqual([]);
    expect(validateSync(refund)).toEqual([]);
    expect(validateSync(media)).toEqual([]);
    expect(qr.amount).toBe(250000);
    expect(review.rating).toBe(5);
    expect(refund.amount).toBe(49000);
    expect(media.size).toBe(1024);
  });

  it("requires payout account default flag to be a boolean", () => {
    expect(
      errorsFor(PayoutAccountDto, {
        bank_code: "970436",
        account_number: "123456789",
        account_holder: "NGUYEN VAN A",
        is_default: "false",
      }),
    ).toHaveLength(1);

    expect(
      errorsFor(PayoutAccountDto, {
        bank_code: "970436",
        account_number: "123456789",
        account_holder: "NGUYEN VAN A",
        is_default: false,
      }),
    ).toEqual([]);
  });

  it("validates admin payment list filters", () => {
    expect(
      errorsFor(AdminPaymentsQueryDto, {
        status: "unknown",
      }),
    ).toHaveLength(1);
    expect(
      errorsFor(AdminPaymentsQueryDto, {
        product_type: "parent_vip",
        payer_user_id: "01HYUSER0000000000000000",
        limit: "20",
      }),
    ).toEqual([]);
  });

  it("validates admin audit log list filters", () => {
    expect(
      errorsFor(AdminAuditLogsQueryDto, {
        action: "x".repeat(121),
      }),
    ).toHaveLength(1);

    expect(
      errorsFor(AdminAuditLogsQueryDto, {
        actor_user_id: "01HYADMIN00000000000000",
        action: "admin.refund",
        entity_type: "payment",
        entity_id: "01HYPAYMENT000000000000",
        limit: "20",
      }),
    ).toEqual([]);
  });

  it("validates admin media moderation actions", () => {
    expect(
      errorsFor(ModerateMediaDto, {
        action: "publish",
      }),
    ).toHaveLength(1);

    expect(
      errorsFor(ModerateMediaDto, {
        action: "approve",
        scan_status: "clean",
      }),
    ).toEqual([]);
  });

  it("validates tutor-admin operation DTOs", () => {
    expect(
      errorsFor(AdminUserStatusDto, {
        status: "deleted",
        reason: "bad",
      }),
    ).toHaveLength(1);
    expect(
      errorsFor(AdminUserStatusDto, {
        status: "suspended",
        reason: "spam",
      }),
    ).toEqual([]);

    expect(
      errorsFor(PlatformPaymentAccountDto, {
        bank_code: "VCB",
        account_number: "123456789",
        account_holder: "KIM THANH TUTOR",
        is_active: "true",
      }),
    ).toHaveLength(1);
    expect(
      errorsFor(PlatformPaymentAccountDto, {
        bank_code: "VCB",
        account_number: "123456789",
        account_holder: "KIM THANH TUTOR",
        is_active: true,
      }),
    ).toEqual([]);

    const pricing = plainToInstance(PricingDto, {
      amount: "79000",
      period_days: "30",
      is_enabled: true,
      reason: "launch",
    });
    expect(validateSync(pricing)).toEqual([]);
    expect(pricing.amount).toBe(79000);

    expect(
      errorsFor(PaidFeatureOverrideDto, {
        enabled: false,
        reason: "hold",
        expires_at: "not-a-date",
      }),
    ).toHaveLength(1);
    expect(
      errorsFor(AdminSystemLogsQueryDto, {
        type: "audit",
        limit: "20",
      }),
    ).toEqual([]);
  });
});
