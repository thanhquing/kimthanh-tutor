import assert from "node:assert/strict";
import type {
  ApiErrorResponse,
  AdminAuthResponse,
  AdminPasswordLogin,
  AuthMeResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthLoginRequest,
  AuthForgotPasswordResponse,
  AuthResetPasswordRequest,
  AuthSessionResponse,
  AdminUserStatusMutation,
  ClassDetail,
  DashboardOverview,
  TutorDashboardOverview,
  MediaAssetStatus,
  MediaUploadRequest,
  MediaUploadResponse,
  PaymentSummary,
  Student,
  TutorProfilePublishResponse,
  TutorPublicDetail,
  TutorSearchCard,
  TrialRequestSummary,
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

const trial = {
  id: "trial_01",
  parent_profile_id: "parent_01",
  lead_id: null,
  student_id: "student_01",
  tutor_profile_id: "tutor_01",
  subject: "Toán",
  grade: "8",
  learning_goal: "Củng cố đại số",
  teaching_mode: "online",
  preferred_schedule: "Thứ 3, Thứ 5 sau 19:00",
  message: "Mong cô hỗ trợ.",
  decline_reason: null,
  status: "pending",
  version: 0,
  created_at: "2026-07-19T00:00:00.000Z",
  responded_at: null,
  expires_at: "2026-08-02T00:00:00.000Z",
  class_contract_id: null,
  contact: null,
  capabilities: {
    can_accept: true,
    can_decline: true,
    can_view_contact: false,
  },
  activation: { state: "not_applicable", expires_at: null },
} satisfies TrialRequestSummary;

assert.deepEqual(roundTrip(trial), trial);

const registerRequest = { email: "new@gmail.com", password: "a-strong-password" } satisfies AuthRegisterRequest;
const registerResponse = {
  user: { id: "user_02", phone: null, email: "new@gmail.com", status: "pending_verification" },
  verification_required: true,
  dev_verification_link: "http://localhost:5173/verify-email?token=abc",
} satisfies AuthRegisterResponse;
const loginRequest = { email: "new@gmail.com", password: "a-strong-password" } satisfies AuthLoginRequest;
const adminPassword = { email: "admin@example.test", password: "correct-password" } satisfies AdminPasswordLogin;
const adminAuthenticated = {
  access_token: "access-token",
  user: me.user,
  consent_required: false,
} satisfies AdminAuthResponse;
const forgotResponse = { ok: true, dev_reset_link: "http://localhost:5173/reset-password?token=xyz" } satisfies AuthForgotPasswordResponse;
const resetRequest = { token: "reset-token", password: "a-new-strong-password" } satisfies AuthResetPasswordRequest;
const authenticated = {
  access_token: "access-token",
  user: me.user,
  consent_required: false,
} satisfies AuthSessionResponse;
const suspendUser = { status: "suspended", reason: "Vi phạm chính sách" } satisfies AdminUserStatusMutation;

assert.deepEqual(roundTrip(registerRequest), registerRequest);
assert.deepEqual(roundTrip(registerResponse), registerResponse);
assert.deepEqual(roundTrip(loginRequest), loginRequest);
assert.deepEqual(roundTrip(adminPassword), adminPassword);
assert.deepEqual(roundTrip(adminAuthenticated), adminAuthenticated);
assert.deepEqual(roundTrip(forgotResponse), forgotResponse);
assert.deepEqual(roundTrip(resetRequest), resetRequest);
assert.deepEqual(roundTrip(authenticated), authenticated);
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

const tutorOverview = {
  profile: {
    id: "tutor_01",
    display_name: "Nguyễn An",
    status: "published",
    moderation_status: "approved",
  },
  summary: { pending_trials: 1, teaching_classes: 1, pending_qr_records: 1 },
  pending_trials: [{
    id: "trial_01",
    subject: "math",
    grade: 8,
    teaching_mode: "online",
    created_at: "2026-07-15T00:00:00.000Z",
  }],
  teaching_classes: [{
    id: "class_01",
    subject: "math",
    status: "active",
    latest_lesson: {
      id: "lesson_01",
      lesson_at: "2026-07-15T00:00:00.000Z",
      subject: "fractions",
    },
    can_create_lesson_log: true,
    updated_at: "2026-07-15T00:00:00.000Z",
  }],
  pending_qr_records: [{
    id: "qr_01",
    class_contract_id: "class_01",
    amount: 800_000,
    collection_status: "created",
    created_at: "2026-07-15T00:00:00.000Z",
  }],
  qr_subscription: {
    id: "sub_01",
    type: "tutor_qr",
    scope_ref_id: null,
    payment_id: "payment_01",
    status: "active",
    auto_renew: false,
    starts_at: "2026-07-01T00:00:00.000Z",
    current_period_end: "2026-08-01T00:00:00.000Z",
    cancelled_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
  capabilities: {
    has_payout_account: true,
    has_active_qr_access: true,
    can_create_qr: true,
  },
  partial_errors: ["pending_trials"],
} satisfies TutorDashboardOverview;

const classDetail = {
  id: "class_01",
  trial_request_id: "trial_01",
  parent_profile_id: "parent_01",
  student_id: "student_01",
  tutor_profile_id: "tutor_01",
  subject: "math",
  status: "active",
  version: 2,
  started_at: "2026-07-01T00:00:00.000Z",
  ended_at: null,
  created_at: "2026-06-20T00:00:00.000Z",
  updated_at: "2026-07-15T00:00:00.000Z",
  parent: { id: "parent_01", display_name: "Anh Minh" },
  student: { id: "student_01", name: "Minh Châu", grade: "9" },
  requested_teaching_mode: "online",
  requested_schedule: "Thứ 2, 4 sau 19:00",
  capabilities: {
    transitions: ["paused", "completed_pending_review", "cancelled"],
    can_create_lesson_log: true,
    can_view_review: false,
  },
} satisfies ClassDetail;

assert.deepEqual(roundTrip(student), student);
assert.deepEqual(roundTrip(lockedDetail), lockedDetail);
assert.deepEqual(roundTrip(overview), overview);
assert.deepEqual(roundTrip(tutorOverview), tutorOverview);
assert.deepEqual(roundTrip(classDetail), classDetail);

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
