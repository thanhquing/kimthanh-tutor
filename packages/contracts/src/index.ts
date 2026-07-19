export type ApiRole = "guest" | "parent" | "tutor" | "admin" | "system";

export type UserStatus =
  | "pending_verification"
  | "pending_consent"
  | "active"
  | "suspended"
  | "deleted";

export type TutorProfileStatus =
  "draft" | "publishable" | "published" | "hidden" | "suspended";

export type ModerationStatus = "pending" | "approved" | "rejected";

export type TeachingMode = "online" | "offline";

export type PaymentStatus =
  "pending" | "paid" | "failed" | "cancelled" | "refunded";

export type ProductType =
  "single_unlock" | "parent_vip" | "parent_tracking" | "tutor_qr";

export type SubscriptionStatus =
  | "pending_payment"
  | "active"
  | "past_due"
  | "expired"
  | "cancelled"
  | "refunded";

export type SubscriptionType =
  "parent_vip_unlock" | "parent_tracking" | "tutor_qr";

export type TrialStatus =
  "pending" | "accepted" | "declined" | "expired" | "cancelled";

export type ClassStatus =
  | "trial_accepted"
  | "active"
  | "paused"
  | "completed_pending_review"
  | "completed"
  | "cancelled";

export type ReviewStatus =
  "pending_moderation" | "published" | "hidden" | "disputed";

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

export interface KeysetPage<T> {
  items: T[];
  next_cursor: string | null;
}

/** Query được API công khai `/tutors/search` chấp nhận. */
export interface TutorSearchQuery {
  subject?: string;
  grade_level?: number;
  teaching_mode?: TeachingMode;
  gender?: "male" | "female" | "other";
  region?: string;
  voice_accent?: string;
  education_level?: string;
  school_name?: string;
  min_exam_score?: number;
  min_gpa?: number;
  fee_min?: number;
  fee_max?: number;
  province_code?: string;
  district_code?: string;
  sort?: "rating" | "newest" | "fee_asc";
  limit?: number;
  cursor?: string;
}

export interface TutorSearchCard {
  id: string;
  display_name: string;
  avatar_media_id: string | null;
  subjects: string[];
  grade_levels: number[];
  teaching_modes: TeachingMode[];
  region: string | null;
  education_level: string | null;
  school_name: string | null;
  fee_min: number | null;
  fee_max: number | null;
  rating_avg: number;
  rating_count: number;
  bio_snippet: string | null;
}

export type TutorUnlockState = "locked" | "unlocked";

export interface TutorPublishedReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

/**
 * `/tutors/:id/public`: các trường locked chỉ xuất hiện ở biến thể unlocked.
 * `rating_*` được giữ vì API hiện trả, còn UI market tuyệt đối không render ở
 * bề mặt preview cho đến khi rule sản phẩm được chốt lại.
 */
export interface TutorPublicDetailBase extends TutorSearchCard {
  gender: string | null;
  voice_accent: string | null;
  unlock_state: TutorUnlockState;
  unlock_via: "single_unlock" | "vip_subscription" | null;
}

export interface TutorPublicDetailLocked extends TutorPublicDetailBase {
  unlock_state: "locked";
  unlock_via: null;
  paywall: {
    message: string;
    products: Array<"single_unlock" | "parent_vip">;
  };
}

export interface TutorPublicDetailUnlocked extends TutorPublicDetailBase {
  unlock_state: "unlocked";
  bio: string | null;
  intro_video_url: string | null;
  reviews: TutorPublishedReview[];
}

export type TutorPublicDetail =
  TutorPublicDetailLocked | TutorPublicDetailUnlocked;

/**
 * Cặp token phát nội bộ ở server. Refresh token KHÔNG bao giờ trả cho
 * JavaScript của app công khai — nó nằm trong cookie HttpOnly `kt_refresh`
 * (xem `AuthSessionResponse`). Chỉ dùng cho tầng phát/rotation phía server.
 */
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

/**
 * Đăng ký/đăng nhập bằng email + password (phương thức hoạt động hiện tại;
 * OAuth là đích lâu dài). Chỉ nhận email `@gmail.com` hoặc domain chứa `edu`.
 */
export interface AuthRegisterRequest {
  email: string;
  password: string;
}

export interface AuthRegisterResponse {
  user: AuthUserSummary;
  verification_required: boolean;
  /** Chỉ có ở non-production để kiểm thử local; không giả định luôn tồn tại. */
  dev_verification_link?: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthVerifyEmailRequest {
  token: string;
}

export interface AuthVerifyEmailResponse {
  verified: boolean;
}

export interface AuthResendVerificationRequest {
  email: string;
}

export interface AuthResendVerificationResponse {
  ok: boolean;
  dev_verification_link?: string;
}

export interface AuthForgotPasswordRequest {
  email: string;
}

export interface AuthForgotPasswordResponse {
  ok: boolean;
  dev_reset_link?: string;
}

export interface AuthResetPasswordRequest {
  token: string;
  password: string;
}

export interface AuthResetPasswordResponse {
  ok: boolean;
}

export interface AuthGoogleOAuth {
  id_token: string;
}

export interface AuthFacebookOAuth {
  access_token: string;
}

export interface AdminPasswordLogin {
  email: string;
  password: string;
}

/** Admin refresh token được giữ trong cookie HttpOnly, không trả cho JavaScript. */
export interface AdminAccessTokenResponse {
  access_token: string;
}

export interface AdminAuthResponse extends AdminAccessTokenResponse {
  user: AuthUserSummary;
  consent_required: boolean;
}

/**
 * Kết quả một phiên đăng nhập cho app công khai (tutor/parent) qua
 * `POST /auth/login` và `POST /auth/oauth/*`. Chỉ trả **access token** (giữ
 * trong RAM tab); refresh token được set vào cookie HttpOnly `kt_refresh` nên
 * không xuất hiện ở body — chống XSS đọc trộm mà vẫn giữ phiên qua reload.
 */
export interface AuthSessionResponse {
  access_token: string;
  user: AuthUserSummary;
  consent_required: boolean;
}

/** Trả về từ `POST /auth/refresh`: access token mới; refresh xoay vòng trong cookie. */
export interface AuthAccessTokenResponse {
  access_token: string;
}

export interface AuthUserSummary {
  id: string;
  phone: string | null;
  email: string | null;
  status: UserStatus;
}

export interface AuthMeResponse {
  user: AuthUserSummary;
  roles: ApiRole[];
  profiles: {
    parent: { id: string } | null;
    tutor: { id: string } | null;
  };
}

export interface LegalDocument {
  id: string;
  doc_type: "terms" | "privacy";
  version: string;
  title: string;
  content_url: string;
  checksum: string;
  published_at: string;
}

export interface ActiveLegalDocumentsResponse {
  terms: LegalDocument | null;
  privacy: LegalDocument | null;
}

export interface RecordLegalConsent {
  terms_document_id: string;
  privacy_document_id: string;
  scroll_reached_bottom: boolean;
  consent_method: "scroll_and_click" | "reaccept";
}

export interface RecordLegalConsentResponse {
  ok: true;
  user_status: "active";
}

/** Nền hợp đồng cho console vận hành; mọi mutation nhạy cảm phải kèm lý do. */
export interface AdminKeysetQuery {
  limit?: number;
  cursor?: string;
}

export interface AdminReasonMutation {
  reason: string;
}

export interface AdminUserStatusMutation extends AdminReasonMutation {
  status: "active" | "suspended";
}

export interface AdminPaidFeatureMutation extends AdminReasonMutation {
  enabled: boolean;
  expires_at?: string;
}

export interface AdminKeysetPage<T> extends KeysetPage<T> {}

export interface ParentProfile {
  id: string;
  display_name: string;
  email: string | null;
  status: string;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  grade: string;
  learning_goals: string | null;
  status: string;
  created_at: string;
}

export interface StudentListResponse {
  items: Student[];
}

export interface TutorProfileResponse {
  id: string;
  display_name: string;
  bio: string | null;
  region: string | null;
  voice_accent: string | null;
  gender: string | null;
  education_level: string | null;
  school_name: string | null;
  student_year: number | null;
  exam_score: number | null;
  gpa: number | null;
  fee_min: number | null;
  fee_max: number | null;
  avatar_media_id: string | null;
  intro_video_media_id: string | null;
  status: TutorProfileStatus;
  moderation_status: ModerationStatus;
  rating_avg: number;
  rating_count: number;
  version: number;
  subjects: string[];
  grade_levels: number[];
  teaching_modes: TeachingMode[];
  offline_areas: Array<{ province_code: string; district_code: string }>;
}

export interface TutorProfilePublishResponse {
  status: TutorProfileStatus;
}

export type MediaKind = "avatar" | "intro_video" | "other";

export type ScanStatus = "pending" | "clean" | "infected";

/** Body cho `POST /media/upload-url`; `size` là số nguyên byte. */
export interface MediaUploadRequest {
  kind: MediaKind;
  content_type: string;
  size: number;
}

export interface MediaUploadResponse {
  media_id: string;
  upload_url: string;
  expires_at: string;
}

/**
 * `GET /media/:id` — trạng thái media của chính chủ sở hữu.
 * `url` là signed read URL ngắn hạn để chủ sở hữu xem trước kể cả khi
 * `scan_status`/`moderation_status` còn `pending`.
 */
export interface MediaAssetStatus {
  media_id: string;
  kind: MediaKind;
  content_type: string;
  moderation_status: ModerationStatus;
  scan_status: ScanStatus;
  url: string | null;
  created_at: string;
}

export type AvailabilityType = "available" | "busy";

export interface TutorAvailability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  type: AvailabilityType;
  note: string | null;
}

export interface TutorPayoutAccount {
  id: string;
  bank_code: string;
  account_number_masked: string;
  account_holder: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrialRequestSummary {
  id: string;
  parent_profile_id: string | null;
  lead_id: string | null;
  student_id: string | null;
  tutor_profile_id: string;
  subject: string;
  grade: number;
  learning_goal: string | null;
  teaching_mode: TeachingMode;
  preferred_schedule: unknown;
  message: string | null;
  status: TrialStatus;
  version: number;
  created_at: string;
  responded_at: string | null;
  expires_at: string | null;
  class_contract_id: string | null;
}

export interface TrialCreateInput {
  tutor_profile_id: string;
  subject: string;
  grade: number;
  learning_goal?: string;
  teaching_mode: TeachingMode;
  preferred_schedule?: unknown;
  message?: string;
  student_id?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface ActivationCompleteResponse {
  user: AuthUserSummary;
  parent_profile: ParentProfile;
  class_contract: ClassSummary;
  consent_required: boolean;
}

export interface ClassSummary {
  id: string;
  trial_request_id: string;
  parent_profile_id: string;
  student_id: string | null;
  tutor_profile_id: string;
  subject: string;
  status: ClassStatus;
  version: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardClassSummary {
  id: string;
  subject: string;
  status: ClassStatus;
  tutor: Pick<TutorSearchCard, "id" | "display_name" | "avatar_media_id">;
  lesson_log_count: number;
  started_at: string | null;
  ended_at: string | null;
}

export interface DashboardOverview {
  student: Pick<Student, "id" | "name" | "grade" | "learning_goals">;
  summary: {
    total_classes: number;
    active_classes: number;
    total_lesson_logs: number;
    latest_lesson_at: string | null;
  };
  latest_lesson: Pick<
    LessonLogSummary,
    "id" | "class_contract_id" | "subject" | "absorption_level" | "lesson_at"
  > | null;
  classes: DashboardClassSummary[];
}

export type AbsorptionLevel = "good" | "normal" | "needs_review";

export interface LessonLogSummary {
  id: string;
  class_contract_id: string;
  tutor_profile_id: string;
  lesson_at: string;
  subject: string;
  content: string;
  homework: string | null;
  absorption_level: AbsorptionLevel;
  tutor_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardTimelineItem extends LessonLogSummary {
  class_subject: string | null;
}

export interface DashboardDetail {
  student: Pick<Student, "id" | "name" | "grade">;
  growth: Partial<Record<AbsorptionLevel, number>>;
  timeline: KeysetPage<DashboardTimelineItem>;
}

export type CollectionStatus =
  "created" | "sent" | "marked_collected" | "cancelled";

export interface TutorQrRecord {
  id: string;
  tutor_profile_id: string;
  class_contract_id: string;
  payout_account_id: string;
  amount: number;
  description: string;
  transfer_content: string;
  qr_url: string;
  payment_link: string;
  collection_status: CollectionStatus;
  marked_collected_at: string | null;
  created_at: string;
}

export type NotificationChannel = "in_app" | "sms" | "email" | "push";
export type NotificationStatus = "queued" | "sent" | "failed" | "read";

export interface NotificationItem {
  id: string;
  channel: NotificationChannel;
  type: string;
  payload: unknown;
  status: NotificationStatus;
  created_at: string;
  read_at: string | null;
}

export interface ReviewSummary {
  id: string;
  class_contract_id: string;
  parent_profile_id: string;
  tutor_profile_id: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  editable_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionSummary {
  id: string;
  type: SubscriptionType;
  scope_ref_id: string | null;
  payment_id: string;
  status: SubscriptionStatus;
  auto_renew: boolean;
  starts_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPage extends KeysetPage<NotificationItem> {}

export interface ClassReviewCapability {
  class_id: string;
  review: ReviewSummary | null;
  can_create: boolean;
  can_edit: boolean;
  can_report: boolean;
}

export interface PaymentSummary {
  payment_id: string;
  product_type: ProductType;
  target_ref_id: string | null;
  amount: number;
  currency: "VND";
  provider: string;
  provider_reference: string;
  status: PaymentStatus;
  paid_at: string | null;
  vietqr: {
    qr_url: string;
    transfer_content: string;
  };
  entitlement:
    | {
        kind: "profile_unlock";
        tutor_profile_id: string | null;
        active: boolean;
      }
    | {
        kind: "subscription";
        type: SubscriptionType;
        scope_ref_id: string | null;
        status: SubscriptionStatus;
        active: boolean;
      };
}
