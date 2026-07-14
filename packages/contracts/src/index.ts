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
}

export interface KeysetPage<T> {
  items: T[];
  next_cursor: string | null;
}

export interface TutorSearchCard {
  id: string;
  display_name: string;
  avatar_url: string | null;
  subjects: string[];
  grade_levels: number[];
  teaching_modes: TeachingMode[];
  region: string | null;
  school_name: string | null;
  expected_fee_min: number | null;
  expected_fee_max: number | null;
  rating_avg: number;
  rating_count: number;
}

export interface PaymentSummary {
  id: string;
  product_type: ProductType;
  target_ref_id: string | null;
  amount: number;
  currency: "VND";
  provider_reference: string;
  status: PaymentStatus;
  created_at: string;
  paid_at: string | null;
}
