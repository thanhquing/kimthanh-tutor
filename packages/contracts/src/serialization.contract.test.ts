import assert from "node:assert/strict";
import type {
  ApiErrorResponse,
  AdminAuthResponse,
  AdminPasswordLogin,
  AuthMeResponse,
  AuthOtpRequest,
  AuthOtpRequestResponse,
  AuthOtpVerify,
  AuthVerifyResponse,
  AdminUserStatusMutation,
  DashboardOverview,
  MediaAssetStatus,
  MediaUploadRequest,
  MediaUploadResponse,
  PaymentSummary,
  Student,
  TutorProfilePublishResponse,
  TutorPublicDetail,
  TutorSearchCard,
} from "./index";

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const card = {
  id: "tutor_01",
  display_name: "Nguyễn An",
  avatar_media_id: "media_01",
  subjects: ["math"],
  grade_levels: [10],
  teaching_modes: ["online"],
  region: "79",
  education_level: "university",
  school_name: "Đại học Sư phạm",
  fee_min: 150_000,
  fee_max: 250_000,
  rating_avg: 4.8,
  rating_count: 12,
  bio_snippet: "Gia sư Toán THPT",
} satisfies TutorSearchCard;

const me = {
  user: {
    id: "user_01",
    phone: "0900000000",
    email: null,
    status: "active",
  },
  roles: ["tutor"],
  profiles: { parent: null, tutor: { id: "tutor_01" } },
} satisfies AuthMeResponse;

const error = {
  code: "VALIDATION_ERROR",
  message: "Dữ liệu không hợp lệ",
  details: ["display_name should not be empty"],
  request_id: "req_01",
} satisfies ApiErrorResponse;

const payment = {
  payment_id: "payment_01",
  product_type: "tutor_qr",
  target_ref_id: "tutor_01",
  amount: 30_000,
  currency: "VND",
  provider: "sepay",
  provider_reference: "KTT000001",
  status: "pending",
  paid_at: null,
  vietqr: { qr_url: "https://qr.example/01", transfer_content: "KTT000001" },
  entitlement: { kind: "subscription", type: "tutor_qr", scope_ref_id: "tutor_01", status: "pending_payment", active: false },
} satisfies PaymentSummary;

assert.deepEqual(roundTrip(card), card);
assert.deepEqual(roundTrip(me), me);
assert.deepEqual(roundTrip(error), error);
assert.deepEqual(roundTrip(payment), payment);

const otpRequest = { channel: "email", destination: "admin@example.test" } satisfies AuthOtpRequest;
const adminPassword = { email: "admin@example.test", password: "correct-password" } satisfies AdminPasswordLogin;
const adminAuthenticated = {
  access_token: "access-token",
  user: me.user,
  consent_required: false,
} satisfies AdminAuthResponse;
const otpRequestResponse = { request_id: "otp_01", expires_at: "2026-07-15T00:05:00.000Z" } satisfies AuthOtpRequestResponse;
const otpVerify = { request_id: "otp_01", code: "272727" } satisfies AuthOtpVerify;
const otpVerified = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  user: me.user,
  consent_required: false,
} satisfies AuthVerifyResponse;
const suspendUser = { status: "suspended", reason: "Vi phạm chính sách" } satisfies AdminUserStatusMutation;

assert.deepEqual(roundTrip(otpRequest), otpRequest);
assert.deepEqual(roundTrip(adminPassword), adminPassword);
assert.deepEqual(roundTrip(adminAuthenticated), adminAuthenticated);
assert.deepEqual(roundTrip(otpRequestResponse), otpRequestResponse);
assert.deepEqual(roundTrip(otpVerify), otpVerify);
assert.deepEqual(roundTrip(otpVerified), otpVerified);
assert.deepEqual(roundTrip(suspendUser), suspendUser);

const student = {
  id: "student_01",
  name: "Bé An",
  grade: "5",
  learning_goals: "Củng cố Toán",
  status: "active",
  created_at: "2026-07-15T00:00:00.000Z",
} satisfies Student;

const lockedDetail = {
  ...card,
  gender: "female",
  voice_accent: "south",
  unlock_state: "locked",
  unlock_via: null,
  paywall: {
    message: "Mở khóa hồ sơ để xem nội dung chi tiết.",
    products: ["single_unlock", "parent_vip"],
  },
} satisfies TutorPublicDetail;

const overview = {
  student,
  summary: {
    total_classes: 1,
    active_classes: 1,
    total_lesson_logs: 2,
    latest_lesson_at: "2026-07-15T00:00:00.000Z",
  },
  latest_lesson: {
    id: "lesson_01",
    class_contract_id: "class_01",
    subject: "math",
    absorption_level: "good",
    lesson_at: "2026-07-15T00:00:00.000Z",
  },
  classes: [{
    id: "class_01",
    subject: "math",
    status: "active",
    tutor: { id: "tutor_01", display_name: "Nguyễn An", avatar_media_id: null },
    lesson_log_count: 2,
    started_at: null,
    ended_at: null,
  }],
} satisfies DashboardOverview;

assert.deepEqual(roundTrip(student), student);
assert.deepEqual(roundTrip(lockedDetail), lockedDetail);
assert.deepEqual(roundTrip(overview), overview);

const publishResponse = { status: "published" } satisfies TutorProfilePublishResponse;
const mediaUploadRequest = { kind: "avatar", content_type: "image/png", size: 20_480 } satisfies MediaUploadRequest;
const mediaUploadResponse = {
  media_id: "media_02",
  upload_url: "https://storage.example/avatar/user_01/media_02?sig=abc",
  expires_at: "2026-07-15T00:10:00.000Z",
} satisfies MediaUploadResponse;
const mediaStatus = {
  media_id: "media_02",
  kind: "avatar",
  content_type: "image/png",
  moderation_status: "pending",
  scan_status: "pending",
  url: "https://storage.example/avatar/user_01/media_02?expires=1",
  created_at: "2026-07-15T00:00:00.000Z",
} satisfies MediaAssetStatus;

assert.deepEqual(roundTrip(publishResponse), publishResponse);
assert.deepEqual(roundTrip(mediaUploadRequest), mediaUploadRequest);
assert.deepEqual(roundTrip(mediaUploadResponse), mediaUploadResponse);
assert.deepEqual(roundTrip(mediaStatus), mediaStatus);
