export type ApiRole = "guest" | "parent" | "tutor" | "admin" | "system";

export type UserStatus = "pending_consent" | "active" | "suspended" | "deleted";

export type TutorProfileStatus =
  | "draft"
  | "publishable"
  | "published"
  | "hidden"
  | "suspended";

export type ModerationStatus = "pending" | "approved" | "rejected";

export type TeachingMode = "online" | "offline";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type ProductType =
  | "single_unlock"
  | "parent_vip"
  | "parent_tracking"
  | "tutor_qr";

export type SubscriptionStatus =
  | "pending_payment"
  | "active"
  | "past_due"
  | "expired"
  | "cancelled"
  | "refunded";

export type SubscriptionType =
  | "parent_vip_unlock"
  | "parent_tracking"
  | "tutor_qr";

export type TrialStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export type ClassStatus =
  | "trial_accepted"
  | "active"
  | "paused"
  | "completed_pending_review"
  | "completed"
  | "cancelled";

export type ReviewStatus =
  | "pending_moderation"
  | "published"
  | "hidden"
  | "disputed";

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
  gender: string | null;
  voice_accent: string | null;
  fee_min: number | null;
  fee_max: number | null;
  rating_avg: number;
  rating_count: number;
  bio_snippet: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
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

export type CollectionStatus = "created" | "sent" | "marked_collected" | "cancelled";

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
    | { kind: "profile_unlock"; tutor_profile_id: string | null; active: boolean }
    | { kind: "subscription"; type: SubscriptionType; scope_ref_id: string | null; status: SubscriptionStatus; active: boolean };
}
