# Mô Hình Miền Nghiệp Vụ

Tài liệu này mô tả thực thể và trạng thái ở mức sản phẩm. Lược đồ cơ sở dữ liệu chi tiết (kiểu dữ liệu, ràng buộc, index) nằm ở `11-database-erd.md`; quy ước chung (ULID, UTC, tiền, soft delete, outbox) ở `15-architecture-and-tech-stack.md`.

## Quyết định sản phẩm đã chốt (ảnh hưởng mô hình)

- **Mở khóa từng hồ sơ (`ProfileUnlock`) là vĩnh viễn** với hồ sơ đó (`expires_at = null`).
- **Gói theo dõi (`parent_tracking`) tính theo từng học sinh** — mỗi con là một gói (`scope_ref_id = student_id`).
- **Khách chưa có tài khoản (guest)** gửi được yêu cầu dạy thử qua thực thể `Lead`, rồi chuyển đổi (convert) thành `ParentProfile` khi kích hoạt.
- Quyền xem chi tiết hồ sơ = có `ProfileUnlock(active)` cho hồ sơ đó **HOẶC** `Subscription(parent_vip_unlock, active)`. Không tạo `ProfileUnlock` giả cho từng hồ sơ khi dùng VIP.

## Các thực thể chính

### User

Đại diện cho tài khoản đăng nhập.

Trường chính:

- `id`
- `phone`
- `email`
- `roles`
- `status`: pending_consent, active, suspended, deleted
- `created_at`

### LegalConsent

Lưu việc người dùng đã đồng ý điều khoản/chính sách.

Trường chính:

- `id`
- `user_id`
- `terms_version`
- `privacy_version`
- `accepted_at`
- `scroll_reached_bottom`
- `consent_method`
- `ip_address`
- `user_agent`

### ParentProfile

Trường chính:

- `id`
- `user_id`
- `display_name`
- `phone`
- `email`
- `status`

### Student

Học sinh/con của phụ huynh.

Trường chính:

- `id`
- `parent_profile_id`
- `name`
- `grade`
- `learning_goals`
- `status`

### TutorProfile

Trường chính:

- `id`
- `user_id`
- `display_name`
- `avatar_media_id` (tham chiếu `MediaAsset`; không lưu URL media dài hạn)
- `intro_video_media_id` (tham chiếu `MediaAsset`; URL đọc là signed URL ngắn hạn)
- `bio`
- `subjects`
- `grade_levels`
- `teaching_modes`
- `region`
- `voice_accent`
- `gender`
- `education_level`
- `school_name`
- `student_year`
- `exam_score`
- `gpa`
- `expected_fee_min`
- `expected_fee_max`
- `offline_areas`
- `status`: draft, publishable, published, hidden, suspended
- `moderation_status`

API presenter cho card/public preview trả `avatar_media_id`, `fee_min`, `fee_max` và `bio_snippet`; không trả `avatar_url` hoặc `expected_fee_*`. `expected_fee_*` là tên cột/domain nội bộ của hồ sơ.

### TutorAvailability

Trường chính:

- `id`
- `tutor_profile_id`
- `day_of_week`: số nguyên 0..6, quy ước **0 = Thứ Hai (T2) … 5 = Thứ Bảy (T7), 6 = Chủ Nhật (CN)** (tuần bắt đầu từ Thứ Hai theo lịch VN). Mọi client hiển thị theo quy ước này; không dùng `Date.getDay()` (Chủ Nhật = 0) làm giá trị lưu.
- `start_time`, `end_time`: chuỗi `HH:mm` (24h), ràng buộc `start_time < end_time`.
- `type`: `available` (rảnh, có thể nhận dạy) | `busy` (bận: lịch học ở trường, lớp đang dạy…). Đây là hai loại lịch; KHÔNG dùng `online`/`offline` làm loại lịch (hình thức dạy thuộc hồ sơ gia sư).
- `note`: ghi chú tùy chọn ≤ 200 ký tự.

### ProfileUnlock

Đại diện quyền xem chi tiết một hồ sơ (mở khóa lẻ). VIP không tạo bản ghi này — quyền suy ra trực tiếp từ `Subscription(parent_vip_unlock)`.

Trường chính:

- `id`
- `parent_profile_id`
- `tutor_profile_id`
- `payment_id`
- `source`: single_unlock (VIP suy ra từ subscription, không lưu ở đây)
- `starts_at`
- `expires_at`: **null = vĩnh viễn** (mặc định theo quyết định sản phẩm)
- `status`: active, expired, revoked

### Subscription

Đại diện gói theo chu kỳ.

Loại và phạm vi (`scope_ref_id`):

- `parent_vip_unlock`: theo user phụ huynh (`scope_ref_id = null`).
- `parent_tracking`: **theo từng học sinh** (`scope_ref_id = student_id`).
- `tutor_qr`: theo user gia sư (`scope_ref_id = null`).

Trường bổ sung: `auto_renew`, `current_period_end`, `version`.

Trạng thái:

- pending_payment
- active
- past_due
- expired
- cancelled
- refunded

### Payment

Trường chính:

- `id`
- `payer_user_id`
- `product_type`
- `amount`
- `currency`
- `provider`
- `provider_reference`
- `status`: pending, paid, failed, cancelled, refunded
- `idempotency_key`, `version`
- `target_ref_id`: id đối tượng đích (tutor_profile_id/student_id) tùy `product_type`
- `created_at`
- `paid_at`

### Refund

Ghi nhận hoàn tiền cho một `Payment`.

Trường chính:

- `id`, `payment_id`, `amount`, `reason`
- `status`: requested, processing, done, rejected
- `actor_user_id` (admin), `created_at`, `processed_at`

### Lead

Khách chưa có tài khoản (guest) để lại liên hệ tối thiểu để gửi yêu cầu dạy thử. Chuyển đổi thành `ParentProfile` khi kích hoạt.

Trường chính:

- `id`
- `contact_name`, `contact_phone`, `contact_email` (PII)
- `converted_parent_profile_id`: null đến khi kích hoạt; nhiều lead lịch sử có thể cùng chuyển đổi về một `ParentProfile`
- `status`: new, converted, expired
- `created_at`, `expires_at`

### ActivationToken

Token một lần để chuyển đổi `Lead` thành `ParentProfile` sau khi gia sư chấp nhận yêu cầu học thử.

Trường chính:

- `id`
- `lead_id`
- `trial_request_id`
- `token_hash`: hash SHA-256 của token raw, không lưu plaintext
- `purpose`: guest_trial_activation
- `expires_at`
- `consumed_at`
- `created_at`

### TrialRequest

Trường chính:

- `id`
- `parent_profile_id`: null nếu là guest
- `lead_id`: null nếu đã có tài khoản (ràng buộc: đúng một trong hai khác null)
- `student_id`: null nếu guest chưa tạo học sinh
- `tutor_profile_id`
- `subject`
- `grade`
- `learning_goal`
- `teaching_mode`
- `preferred_schedule`
- `message`
- `decline_reason`: lý do từ chối riêng, không sửa/nối vào lời nhắn gốc
- `contact_snapshot`: liên hệ tối thiểu tại thời điểm gửi (PII)
- `status`: pending, accepted, declined, expired, cancelled
- `version` (optimistic lock chống double-accept)
- `created_at`
- `responded_at`
- `expires_at`

### ClassContract

Quan hệ lớp học giữa phụ huynh/học sinh và gia sư.

Trường chính:

- `id`
- `trial_request_id`
- `parent_profile_id`
- `student_id`
- `tutor_profile_id`
- `subject`
- `status`: trial_accepted, active, paused, completed_pending_review, completed, cancelled
- `started_at`
- `ended_at`

### LessonLog

Sổ đầu bài.

Trường chính:

- `id`
- `class_contract_id`
- `tutor_profile_id`
- `lesson_at`
- `subject`
- `content`
- `homework`
- `absorption_level`: good, normal, needs_review
- `tutor_note`
- `created_at`

### Review

Trường chính:

- `id`
- `class_contract_id`
- `parent_profile_id`
- `tutor_profile_id`
- `rating`
- `comment`
- `status`: pending_moderation, published, hidden, disputed
- `created_at`
- `updated_at`

### TutorPaymentQrRecord

Ghi nhận QR/link thanh toán do gia sư tạo.

Trường chính:

- `id`
- `tutor_profile_id`
- `class_contract_id`
- `amount`
- `description`
- `qr_url`
- `payment_link`
- `collection_status`: created, sent, marked_collected, cancelled
- `marked_collected_at`

### Notification

Trường chính:

- `id`
- `recipient_user_id`
- `channel`: in_app, sms, email, push
- `type`
- `payload`
- `status`: queued, sent, failed, read
- `created_at`

### TutorPayoutAccount

Tài khoản nhận tiền của gia sư, dùng để tạo QR/link thanh toán học phí (nền tảng không thu hộ).

Trường chính: `id`, `tutor_profile_id`, `bank_code`, `account_number` (PII), `account_holder` (PII), `is_default`.

### MediaAsset

Ảnh đại diện/video giới thiệu và media khác. Có kiểm duyệt và quét virus trước khi public.

Trường chính: `id`, `owner_user_id`, `kind` (avatar/intro_video/other), `storage_key`, `content_type`, `size_bytes`, `moderation_status`, `scan_status`.

### LegalDocument

Phiên bản Điều khoản/Chính sách. `LegalConsent` tham chiếu bản cụ thể qua `terms_document_id`/`privacy_document_id`.

Trường chính: `id`, `doc_type` (terms/privacy), `version`, `locale`, `title`, `content_url`, `checksum`, `is_active`, `published_at`.

### Thực thể hạ tầng (kỹ thuật, không hiển thị người dùng)

- `AuthAccount`: liên kết user với tài khoản Google/Facebook đã verify phía server (`provider`, `provider_user_id`, email/profile snapshot).
- `AdminCredential`: credential email/password chỉ cho user có role `admin`; lưu scrypt hash, `failed_attempts`, `locked_until`, `password_changed_at`, được provision/rotate ngoài giao diện. Tăng số lần sai phải compare-and-swap/ghi nguyên tử; rotate password thu hồi mọi refresh token còn hoạt động.
- `RefreshToken`: chỉ lưu hash trong PostgreSQL với `user_id`, `expires_at`, `revoked_at`, `rotated_to_id`, `created_ip`. Rotation claim token cũ trong transaction rồi nối tới token con; xung đột đồng thời trong grace ngắn không thu hồi token con của request thắng, reuse sau grace thu hồi mọi refresh token còn hoạt động của user.
- `EmailToken`: token verify email / reset password đã hash, hết hạn, dùng-một-lần — chống brute-force.
- `WebhookEvent`: chống trùng + lưu kết quả verify chữ ký webhook thanh toán.
- `IdempotencyKey`: chống double-submit các API tạo tiền.
- `OutboxEvent`: hàng đợi tin cậy cho side-effect (thông báo, đồng bộ search, gọi provider).
- `AuditLog`: nhật ký bất biến cho hành động nhạy cảm/admin.
- `ReviewEdit`: lịch sử chỉnh sửa đánh giá.
- `PlatformPaymentAccount`: cấu hình tài khoản VietQR nền tảng do `tutor-admin` quản lý; số tài khoản là PII và response phải mask.
- `ProductPricing`: cấu hình giá/kỳ hạn/bật tắt bán cho từng sản phẩm thanh toán; checkout đọc bảng này nếu có, fallback default cho local/dev.
- `PaidFeatureOverride`: override bật/tắt paid feature theo user, có lý do và hạn dùng; access-control/checkout phải đọc trước entitlement từ payment/subscription.

## Quan hệ chính

- `User` có thể có `ParentProfile`, `TutorProfile` hoặc cả hai trong tương lai.
- `ParentProfile` có nhiều `Student`.
- `Lead` có thể chuyển đổi thành `ParentProfile`; `Lead` gửi được `TrialRequest` khi là guest.
- `TutorProfile` có nhiều `TutorAvailability`, `TutorPayoutAccount`, `TrialRequest`, `ClassContract`, `LessonLog`, `Review`.
- Dữ liệu tìm kiếm của `TutorProfile` (môn/khối/hình thức/khu vực offline) được **chuẩn hóa thành bảng con** (xem `11-database-erd.md`), không lưu chuỗi CSV.
- `TrialRequest` có thể tạo `ClassContract` (optimistic lock chống double-accept).
- `ClassContract` có nhiều `LessonLog` và tối đa một `Review` chính từ phụ huynh.
- `Subscription(parent_tracking)` gắn với một `Student` qua `scope_ref_id`.
- `Payment` có thể kích hoạt `ProfileUnlock` hoặc `Subscription`, và có thể có nhiều `Refund`.
- `TutorProfile.rating_avg/rating_count` là dữ liệu denormalized, cập nhật khi `Review` đổi trạng thái published.
