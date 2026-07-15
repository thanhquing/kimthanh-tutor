import assert from "node:assert/strict";
import type {
  ApiErrorResponse,
  AuthMeResponse,
  PaymentSummary,
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
  gender: "female",
  voice_accent: "south",
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
