# Catalog Endpoint API (tutor-api)

Danh mục endpoint giai đoạn 1, làm nguồn tham chiếu để implement. Đối chiếu:
`ai-docs/06-api-contract.md` (quy ước), `11-database-erd.md` (bảng), `13` (bảo mật), `12` (hiệu năng).

## Quy ước chung

- Prefix `/api/v1`. Trả JSON. Lỗi dạng `{ code, message, details? }` (mã ở `06`).
- Auth: `Bearer <JWT>`. Vai trò: `guest|parent|tutor|admin`.
- Phân trang: keyset `?limit=&cursor=`, trả `{ items, next_cursor }`.
- Tiền: số nguyên VND; API coerce numeric string phổ biến từ form (`"100000"`) ở các DTO số, gồm cả phần tử mảng số như `grade_levels`. Thời gian: ISO-8601 UTC; khoảng giờ availability dùng `HH:mm`.
- Chuỗi bắt buộc sau khi trim không được rỗng (`"   "` → `VALIDATION_ERROR`) ở các field như tên học sinh, môn học, contact guest, display name.
- Hành động tiền: header `Idempotency-Key`.
- Cột ✅ = đã implement trong `tutor-api/src` và có unit test service/contract trọng yếu. `TODO(worker)` còn lại là tích hợp nền như gửi OTP/outbox worker, không phải service stub API.

## Thứ tự thực thi (phụ thuộc)

1. **Nền tảng**: config, PrismaModule, common (filter/guards/pagination), health.
2. **Auth + Consent** (gate mọi thứ): Google/Facebook OAuth, phone OTP fallback/local, JWT, legal documents, ghi consent.
3. **Tutors + Search** (hot-path công khai): CRUD hồ sơ gia sư + bảng chuẩn hóa, search.
4. **Parents + Students**.
5. **Billing** (payments/VietQR + webhook SePay) → mở khóa/subscription.
6. **Marketplace access** (profile detail có kiểm tra unlock/VIP).
7. **Trials → Classes** (leads guest, state machine, optimistic lock).
8. **Lesson logs → Dashboard** (kiểm tra gói tracking theo học sinh).
9. **Reviews** (sau lớp, cập nhật rating_avg).
10. **QR payments** (VietQR từ payout account).
11. **Notifications** (outbox worker), **Admin/Moderation**, **Audit**.
12. **Tutor Admin nội bộ**: dashboard vận hành, user management, logs, cấu hình VietQR nền tảng, pricing và paid-feature override.

---

## 1. Auth & Consent

| Method | Path | Vai trò | Input | Output | Ghi/đọc bảng | Quy tắc |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/auth/oauth/google` | guest | `{ id_token }` | `{ access_token, refresh_token, user, auth_provider, consent_required }` | `users`,`auth_accounts` | Server verify Google ID token với `GOOGLE_CLIENT_ID`; chỉ nhận email đã verified; link theo `(provider, provider_user_id)` hoặc email verified ✅ |
| POST | `/auth/oauth/facebook` | guest | `{ access_token }` | `{ access_token, refresh_token, user, auth_provider, consent_required }` | `users`,`auth_accounts` | Server verify Facebook token bằng debug_token với app id/secret; link theo `(provider, provider_user_id)` hoặc email nếu có ✅ |
| POST | `/auth/otp/request` | guest | `{ channel, destination }` | `{ request_id, expires_at }` | `otp_requests` | Phone OTP fallback/local; non-production dùng mã cố định `272727`; production cần provider SMS/email trước khi bật rộng; lưu hash mã ✅ |
| POST | `/auth/otp/verify` | guest | `{ request_id, code }` | `{ access_token, refresh_token, user, consent_required }` | `otp_requests`,`users` | Sai quá số lần → khóa tạm; SMS tạo user `pending_consent`; local verify bằng `272727` ✅ |
| POST | `/auth/refresh` | any | `{ refresh_token }` | `{ access_token, refresh_token }` | `refresh_tokens` | Rotation + revoke-on-reuse ✅ |
| GET | `/auth/me` | authenticated | — | `{ user, roles, profiles }` | `users` | Cho phép `pending_consent` để FE biết trạng thái sau login/OTP ✅ |
| GET | `/legal/documents/active` | guest | — | `{ terms, privacy }` (version, content_url, checksum) | `legal_documents` | ✅ |
| POST | `/legal/consents` | pending_consent | `{ terms_document_id, privacy_document_id, scroll_reached_bottom, consent_method }` | `{ ok, user_status }` | `legal_consents`,`users` | scroll phải true; kích hoạt user; ghi IP/UA nếu cho phép ✅ |

## 2. Tutors (hồ sơ gia sư) & Search

| Method | Path | Vai trò | Input | Output | Bảng | Quy tắc |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/tutors/search` | guest | `?subject&grade_level&teaching_mode&gender&region&voice_accent&education_level&school_name&min_exam_score&min_gpa&fee_min&fee_max&province_code&district_code&sort&limit&cursor` | `{ items:[card], next_cursor }` | `tutor_profiles`+bảng chuẩn hóa | Chỉ `published`; `grade_level` 1..12; `min_exam_score` 0..30; `min_gpa` 0..10; đọc `rating_avg` denormalized; keyset; validate `fee_min <= fee_max`; không trả video/review ✅ |
| GET | `/tutors/:id/public` | guest/parent | — | card + paywall meta + `unlock_state`,`unlock_via`; unlocked trả `bio`,`intro_video_url`,`reviews` | `tutor_profiles`,`profile_unlocks`,`subscriptions`,`reviews`,`media_assets` | Chi tiết chỉ khi có unlock/VIP; `unlock_via=null|single_unlock|vip_subscription`; media = signed URL ✅ |
| POST | `/tutors/me/profile` | active user | `TutorProfileDto` | profile | `tutor_profiles`+bảng chuẩn hóa | Bootstrap gia sư; cấp role `tutor`; sync bảng chuẩn hóa; `grade_levels` trong 1..12; validate `expected_fee_min <= expected_fee_max` ✅ |
| GET | `/tutors/me/profile` | tutor | — | profile | `tutor_profiles`+bảng chuẩn hóa | Của mình; trả cùng shape với POST/PATCH để FE reload màn quản lý hồ sơ ✅ |
| PATCH | `/tutors/me/profile` | tutor | partial | profile | như trên | Đổi dữ liệu search → cập nhật bảng chuẩn hóa + outbox invalidate; `grade_levels` trong 1..12; giữ fee range hợp lệ cả khi patch một đầu ✅ |
| POST | `/tutors/me/profile/publish` | tutor | — | `{ status }` | `tutor_profiles`,`outbox_events` | Đủ điều kiện `publishable` mới cho `published` ✅ |
| GET | `/tutors/me/availabilities` | tutor | — | `{ items }` | `tutor_availabilities` | Của mình; sort theo ngày/giờ ✅ |
| POST | `/tutors/me/availabilities` | tutor | `{ day_of_week, start_time, end_time, type?, note? }` | `{ id }` | `tutor_availabilities` | `start_time/end_time` chuẩn `HH:mm`; validate `start_time < end_time` ✅ |
| DELETE | `/tutors/me/availabilities/:id` | tutor | — | `{ ok }` | `tutor_availabilities` | Của mình ✅ |
| GET | `/tutors/me/payout-accounts` | tutor | — | `{ items:[{ id, bank_code, account_number_masked, account_holder, is_default, created_at, updated_at }] }` | `tutor_payout_accounts` | Của mình; không trả số tài khoản đầy đủ để tránh rò PII ✅ |
| POST | `/tutors/me/payout-accounts` | tutor | `{ bank_code, account_number, account_holder, is_default?: boolean }` | account masked + `account_holder`, timestamps | `tutor_payout_accounts` | PII; của mình; default account reset các account cũ; không trả số tài khoản đầy đủ; `is_default` phải là boolean, không dùng chuỗi ✅ |
| POST | `/media/upload-url` | tutor/parent | `{ kind, content_type, size }` | `{ upload_url, media_id, expires_at }` | `media_assets` | Signed upload; validate type/size; scan+moderation trước public ✅ |

## 3. Parents & Students

| Method | Path | Vai trò | Input | Output | Bảng | Quy tắc |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/parents/me` | active user | profile | profile + `email` | `parent_profiles`,`users` | Bootstrap phụ huynh; cấp role `parent`; cập nhật email; trả lại email để UI reload profile ngay ✅ |
| GET | `/parents/me` | parent | — | profile | `parent_profiles` | Của mình ✅ |
| PATCH | `/parents/me` | parent | profile | profile | `parent_profiles`,`users` | Cập nhật hồ sơ/email của mình ✅ |
| GET | `/parents/me/students` | parent | — | list | `students` | Của mình ✅ |
| POST | `/parents/me/students` | parent | `{ name, grade, learning_goals }` | student | `students` | PII trẻ em; ownership ✅ |
| PATCH | `/parents/me/students/:id` | parent | partial | student | `students` | Ownership ✅ |
| DELETE | `/parents/me/students/:id` | parent | — | `{ ok }` | `students` | Ownership; soft delete ✅ |

## 4. Billing (VietQR + webhook SePay)

| Method | Path | Vai trò | Input | Output | Bảng | Quy tắc |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/billing/checkout` | parent/tutor | `{ product_type, target_ref_id? }` + `Idempotency-Key` | `{ payment_id, amount, vietqr:{ qr_url, transfer_content }, status, entitlement }` | `payments`,`idempotency_keys`,`subscriptions?` | Sinh mã đơn `provider_reference`; QR vào TK nền tảng; idempotent; chặn mua trùng gói đang `pending_payment/active/past_due` ✅ |
| GET | `/billing/payments/:id` | owner | — | payment status | `payments` | Của mình; UI poll khi webhook trễ ✅ |
| POST | `/billing/webhook/sepay` | system | payload SePay | `{ received, payment_id?, status? }` | `webhook_events`,`payments`,`profile_unlocks`,`subscriptions`,`outbox_events` | **Verify API key + IP allowlist**; đối chiếu số tiền+mã; chống trùng; cấp quyền trong transaction ✅ |
| GET | `/billing/subscriptions` | parent/tutor | — | list | `subscriptions` | Của mình ✅ |
| POST | `/billing/subscriptions/:id/cancel` | owner | — | subscription | `subscriptions` | Của mình; idempotent nếu đã cancel ✅ |
| POST | `/admin/refunds` | admin | `{ payment_id, amount?, reason }` | refund | `refunds`,`payments`,`profile_unlocks`,`subscriptions`,`audit_logs` | Thu hồi quyền theo chính sách ✅ |

## 5. Trials → Classes

| Method | Path | Vai trò | Input | Output | Bảng | Quy tắc |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/trials` | guest/parent | `{ tutor_profile_id, subject, grade, learning_goal, teaching_mode, preferred_schedule, message, student_id?, contact? }` | trial | `trial_requests`,`leads`,`outbox_events` | Guest → tạo `lead`; parent → link student; status `pending` ✅ |
| GET | `/trials/mine` | parent/tutor | `?role` | list | `trial_requests` | Bên gửi/bên nhận ✅ |
| POST | `/trials/:id/accept` | tutor | — | `{ trial, class_contract, activation_token? }` | `trial_requests`,`class_contracts`,`activation_tokens`,`outbox_events` | Optimistic lock (`version`); chỉ `pending`; guest lead nhận token raw một lần, DB lưu hash ✅ |
| POST | `/trials/:id/decline` | tutor | `{ reason? }` | trial | `trial_requests` | Chỉ `pending` ✅ |
| POST | `/trials/:id/cancel` | parent | — | trial | `trial_requests` | Chỉ `pending`, của mình ✅ |
| POST | `/activation/complete` | guest(token) | `{ activation_token }` | `{ user, parent_profile, class_contract, consent_required }` | `activation_tokens`,`users`,`parent_profiles`,`leads`,`trial_requests`,`class_contracts` | Convert lead → parent; token hash + expiry + consume atomically ✅ |
| GET | `/classes/mine` | parent/tutor | — | list | `class_contracts` | Thuộc lớp ✅ |
| POST | `/classes/:id/transition` | tutor/parent | `{ to }` | class | `class_contracts`,`outbox_events` | State machine + optimistic lock ✅ |

## 6. Lesson logs → Dashboard

| Method | Path | Vai trò | Input | Output | Bảng | Quy tắc |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/classes/:id/lesson-logs` | tutor | `?limit&cursor` | `{ items:[log], next_cursor }` | `lesson_logs` | Chỉ gia sư của lớp; keyset theo `lesson_at,id`; không mở cho parent để tránh bypass gói tracking ✅ |
| POST | `/classes/:id/lesson-logs` | tutor | `{ lesson_at, subject, content, homework, absorption_level, tutor_note }` | log | `lesson_logs`,`outbox_events` | Chỉ gia sư của lớp ✅ |
| PATCH | `/lesson-logs/:id` | tutor | partial | log | `lesson_logs` | Trong khung thời gian cho phép ✅ |
| GET | `/dashboard/students/:id/overview` | parent | — | overview + `latest_lesson` | `class_contracts`,`lesson_logs` | Của mình; luôn cho xem tổng quan; trả lesson mới nhất để UI preview dashboard ✅ |
| GET | `/dashboard/students/:id/detail` | parent | `?cursor` | timeline + growth | `lesson_logs`,`subscriptions` | Cần `parent_tracking active` cho đúng học sinh; chưa có gói trả `PAYMENT_REQUIRED`, gói hết hạn/pending trả `SUBSCRIPTION_EXPIRED`; keyset ✅ |

## 7. Reviews

| Method | Path | Vai trò | Input | Output | Bảng | Quy tắc |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/classes/:id/review` | parent/tutor | — | `{ class_id, review, can_create, can_edit, can_report }` | `reviews`,`class_contracts` | Thành viên lớp; FE dùng capability flags để hiển thị nút tạo/sửa/report ✅ |
| POST | `/classes/:id/review` | parent | `{ rating, comment }` | review | `reviews`,`class_contracts`,`outbox_events` | Lớp completed_pending_review/completed; 1/lớp; set `editable_until`; cập nhật rating ✅ |
| PATCH | `/reviews/:id` | parent | `{ rating, comment }` | review | `reviews`,`review_edits` | Đến `editable_until`; lưu lịch sử; cập nhật rating ✅ |
| POST | `/reviews/:id/report` | tutor | `{ reason }` | `{ status }` | `reviews` | → `disputed` ✅ |
| POST | `/admin/reviews/:id/moderate` | admin | `{ action }` | review | `reviews`,`audit_logs`,`tutor_profiles` | publish/hidden; cập nhật `rating_avg` ✅ |

## 8. QR payments (học phí — VietQR)

| Method | Path | Vai trò | Input | Output | Bảng | Quy tắc |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/qr/records` | tutor | `{ class_contract_id, amount, description, payout_account_id }` | record + `{ qr_url, payment_link, transfer_content }` | `tutor_payment_qr_records`,`subscriptions`,`tutor_payout_accounts` | Cần gói `tutor_qr active` + payout account; QR vào TK gia sư ✅ |
| GET | `/qr/records` | tutor | `?class_contract_id` | list | `tutor_payment_qr_records` | Của mình ✅ |
| POST | `/qr/records/:id/mark-collected` | tutor | — | record | `tutor_payment_qr_records` | Chỉ đánh dấu; hệ thống không xác nhận dòng tiền ✅ |

## 9. Admin / Moderation / Notifications

| Method | Path | Vai trò | Input | Output | Bảng | Quy tắc |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/admin/moderation/queue` | admin | — | `{ tutors, media, reviews }` | `tutor_profiles`,`media_assets`,`reviews` | ✅ |
| POST | `/admin/tutors/:id/status` | admin | `{ status }` | tutor | `tutor_profiles`,`audit_logs` | hidden/suspended/published; audit ✅ |
| POST | `/admin/media/:id/moderate` | admin | `{ action: approve\|reject, scan_status? }` | media | `media_assets`,`audit_logs` | Duyệt/từ chối media; public read chỉ dùng `approved + clean`; audit ✅ |
| GET | `/admin/payments` | admin | `?status&product_type&payer_user_id&limit&cursor` | `{ items:[payment], next_cursor }` | `payments` | Keyset theo `created_at,id`; phục vụ tra cứu vận hành/refund; không trả PII ngân hàng ✅ |
| GET | `/admin/audit-logs` | admin | `?actor_user_id&action&entity_type&entity_id&limit&cursor` | `{ items:[audit_log], next_cursor }` | `audit_logs` | Keyset theo `created_at,id`; trả hash before/after, không trả IP/raw PII ✅ |
| GET | `/notifications` | parent/tutor | `?cursor` | list | `notifications` | Của mình; keyset ✅ |
| POST | `/notifications/:id/read` | owner | — | `{ ok }` | `notifications` | Idempotent ✅ |

## 10. Tutor Admin App / Operations

Nhóm endpoint này phục vụ thư mục app `tutor-admin`. Đây là console nội bộ cho chủ dự án, không public. Tất cả endpoint dùng `@Roles("admin")`, keyset pagination cho list lớn, mask PII khi trả số tài khoản/SĐT/email, và ghi `audit_logs` cho mọi thay đổi cấu hình/quyền/người dùng.

Các endpoint dưới đây đã được implement trong `tutor-api/src/modules/admin`, có unit test trọng yếu và đã pass Flow 12 bằng `tutor-api/scripts/verify-flow-12-tutor-admin-ops.sh`.

| Method | Path | Vai trò | Input | Output | Bảng | Quy tắc |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/admin/overview` | admin | `?from&to` | `{ users, registrations_by_day, moderation, payments, paid_features }` | `users`,`tutor_profiles`,`payments`,`subscriptions`,`profile_unlocks` | Thống kê user đăng ký theo ngày/role/status, pending approval, payment summary; không trả PII raw ✅ |
| GET | `/admin/users` | admin | `?role&status&q&created_from&created_to&limit&cursor` | `{ items:[user_admin_card], next_cursor }` | `users`,`parent_profiles`,`tutor_profiles`,`subscriptions`,`paid_feature_overrides` | Keyset; search theo email/phone/id; response chỉ trả email/phone masked; trả profile summary + trạng thái gói/quyền trả phí ✅ |
| GET | `/admin/users/:id` | admin | — | `{ user, profiles, subscriptions, payments_summary, feature_overrides }` | như trên + `payments` | Detail phục vụ drawer admin; mask PII nhạy cảm ✅ |
| PATCH | `/admin/users/:id/status` | admin | `{ status: "active"\|"suspended", reason }` | user | `users`,`refresh_tokens`,`audit_logs` | Khóa/mở account; không cho tự khóa chính mình; reason bắt buộc; suspend revoke refresh tokens ✅ |
| GET | `/admin/system-logs` | admin | `?type=audit\|webhook\|outbox&status&actor_user_id&entity_type&entity_id&limit&cursor` | `{ items:[log], next_cursor }` | `audit_logs`,`webhook_events`,`outbox_events` | View logs vận hành; không trả IP/raw payload/secret; link được về entity ✅ |
| GET | `/admin/platform/payment-account` | admin | — | `{ bank_code, account_number_masked, account_holder, is_active, updated_at }` | `platform_payment_accounts` | Đọc tài khoản VietQR nền tảng đang dùng để sinh checkout QR; mask số TK ✅ |
| PATCH | `/admin/platform/payment-account` | admin | `{ bank_code, account_number, account_holder, is_active }` | masked account | `platform_payment_accounts`,`audit_logs` | Cập nhật tài khoản VietQR nền tảng; account_number là PII; checkout mới dùng account active mới, fallback env nếu chưa có DB config ✅ |
| GET | `/admin/pricing` | admin | — | `{ items:[{ product_type, amount, currency, period_days, is_enabled }] }` | `product_pricing` | Giá bán đang áp dụng cho checkout; fallback default nếu chưa cấu hình DB ✅ |
| PATCH | `/admin/pricing/:product_type` | admin | `{ amount, period_days?, is_enabled, reason }` | pricing | `product_pricing`,`audit_logs` | Cấu hình phí; tiền nguyên VND; disable thì checkout product đó trả lỗi rõ ràng ✅ |
| GET | `/admin/users/:id/paid-features` | admin | — | `{ items:[feature, entitlement_state, override] }` | `paid_feature_overrides`,`subscriptions`,`profile_unlocks` | Xem trạng thái paid features của user, gồm override admin và quyền từ payment ✅ |
| PATCH | `/admin/users/:id/paid-features/:feature` | admin | `{ enabled, reason, expires_at? }` | feature override | `paid_feature_overrides`,`audit_logs` | Bật/tắt chức năng trả phí theo user; `BillingService` và `AccessService` đọc override trước khi cho mua/dùng ✅ |
| GET | `/admin/moderation/queue` | admin | — | `{ tutors, media, reviews }` | `tutor_profiles`,`media_assets`,`reviews` | Tái dùng cho màn phê duyệt ✅ |
| POST | `/admin/tutors/:id/status` | admin | `{ status }` | tutor | `tutor_profiles`,`audit_logs` | Tái dùng cho phê duyệt/ẩn/khóa hồ sơ gia sư ✅ |
| POST | `/admin/reviews/:id/moderate` | admin | `{ action }` | review | `reviews`,`audit_logs`,`tutor_profiles` | Tái dùng cho phê duyệt đánh giá ✅ |
| POST | `/admin/media/:id/moderate` | admin | `{ action, scan_status? }` | media | `media_assets`,`audit_logs` | Tái dùng cho phê duyệt media ✅ |

## Ghi chú implement

- Không còn endpoint catalog nào dùng service stub `NotImplementedException`; enum/helper `NOT_IMPLEMENTED` chỉ còn là common error fallback.
- Guard: `JwtAuthGuard` + `@Roles()` + kiểm tra ownership trong service (fail closed).
- Side-effect (notification/đồng bộ) ghi `outbox_events`, không gọi đồng bộ.
- Health: `/healthz`, `/readyz` (readyz check DB).
