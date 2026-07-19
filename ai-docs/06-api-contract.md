# Ghi Chú Quy Ước API

Tài liệu này mô tả các nhóm API cần có ở mức sản phẩm, chưa phải bản OpenAPI chi tiết.

Khi thiết kế API chi tiết, đối chiếu bảng đọc/ghi trong `11-database-erd.md`.

## Nguyên tắc API

- API phải tách rõ nhóm công khai, phụ huynh đã đăng nhập, gia sư đã đăng nhập và quản trị viên.
- Mỗi API thay đổi trạng thái quan trọng phải kiểm tra người thực hiện, quyền sở hữu (ownership) và trạng thái hiện tại (fail closed).
- Webhook thanh toán là nguồn kích hoạt mở khóa/gói định kỳ sau cùng, và **phải verify chữ ký + đối chiếu số tiền** trước khi tin.
- Bảng điều khiển chi tiết phải kiểm tra gói theo dõi của **đúng học sinh** còn hiệu lực.
- Video/đánh giá chi tiết phải kiểm tra quyền mở khóa hồ sơ hoặc VIP còn hiệu lực; media trả về dạng **signed URL hết hạn ngắn**.

## Quy ước kỹ thuật chung (áp dụng mọi endpoint)

- **Versioning**: prefix `/api/v1`.
- **Định dạng lỗi thống nhất**: `{ code, message, details?, request_id? }` với `code` thuộc danh sách chuẩn (cuối tài liệu).
- **Phân trang keyset (seek)**: tham số `limit` + `cursor`; response trả `items` + `next_cursor`. **Không dùng offset** cho danh sách lớn (search, timeline). Xem `12-non-functional-requirements.md`.
- **Idempotency**: API tạo tiền/hành động nhạy cảm nhận header `Idempotency-Key`; lặp key trả kết quả cũ, không tạo mới.
- **Rate limiting**: mọi nhóm có giới hạn theo IP/user/thiết bị; vượt → `RATE_LIMITED` + `Retry-After`. Chi tiết ở `13-security-and-threat-model.md`.
- **Xác thực**: JWT access ngắn hạn + refresh quay vòng; API không phụ thuộc session RAM giữa request. Refresh token hash/rotation/revocation hiện nằm trong PostgreSQL.
- **Validate**: DTO/schema chặt, từ chối field thừa; chống mass-assignment.
- **Side-effect** (thông báo/đồng bộ search): không làm đồng bộ trong request — ghi outbox, worker xử lý.

## API công khai

### Tìm kiếm gia sư

Mục đích:

- Cho khách chưa đăng nhập/phụ huynh tìm gia sư.

Dữ liệu vào:

- subject
- grade_level (1..12)
- teaching_mode
- gender
- region
- voice_accent
- education_level
- school_name
- min_exam_score (0..30)
- min_gpa (0..10)
- fee_min
- fee_max
- offline_area (province/district code)
- cursor (keyset, thay cho page/offset)
- limit
- sort (vd rating, fee, mới nhất — kèm khóa keyset ổn định)

Dữ liệu ra:

- Danh sách thẻ xem thử của gia sư (đọc `rating_avg`/`rating_count` denormalized, không AGG runtime).
- `next_cursor` để lấy trang sau.
- Không trả đánh giá/bình luận/video chi tiết nếu chưa mở khóa.

### Lấy chi tiết công khai của gia sư

Dữ liệu ra:

- Chi tiết ở mức xem thử.
- Siêu dữ liệu của màn khóa trả phí.
- Trạng thái mở khóa nếu có xác thực/phiên tạm.

## API xác thực và consent

- Đăng nhập/đăng ký bằng email + password (register → verify email qua link → login → forgot/reset) hoặc Google OAuth chạy server-side (Authorization Code): `GET /auth/oauth/google/start` đặt nonce vào cookie `kt_oauth_state` rồi redirect sang Google, `GET /auth/oauth/google/callback` verify state, đổi `code` lấy `id_token` bằng `client_secret` ở server, register-or-login rồi set cookie phiên. SĐT chỉ để liên hệ, KHÔNG đăng nhập (đã bỏ OTP-SMS).
- Parent/tutor giữ access token trong RAM tab; refresh token nằm trong cookie HttpOnly `kt_refresh` (không trả ra body). `/auth/refresh` đọc cookie để quay vòng refresh token và set lại cookie (boot app gọi silent refresh để giữ đăng nhập qua reload), `/auth/logout` đọc cookie để thu hồi refresh token hiện tại và clear cookie. Lỗi refresh 5xx/network tạm thời không được tự xóa phiên còn dùng được; `AUTH_REQUIRED` mới kết thúc phiên local.
- Admin đăng nhập qua endpoint riêng bằng email/password đã provision; server kiểm tra scrypt hash, status và role `admin`, tăng failed-attempt bằng compare-and-swap, khóa 15 phút sau 5 lần sai. Access token chỉ giữ trong RAM; refresh token hash nằm trong PostgreSQL và token thô chỉ ở cookie HttpOnly `SameSite=Strict`. `/auth/admin/refresh` claim/rotate trong transaction, cho grace 5 giây với xung đột multi-tab; reuse sau grace thu hồi mọi refresh token còn hoạt động của user. `/auth/admin/logout` thu hồi phiên và rotate password thu hồi mọi refresh token của admin.
- Tạo tài khoản ở trạng thái chờ consent.
- Lấy version pháp lý hiện tại.
- Ghi nhận đồng ý điều khoản/chính sách.
- Lấy thông tin người dùng hiện tại.

Quy tắc:

- Người dùng chưa đồng ý consent thì không được kích hoạt.

## API cho phụ huynh

- Quản lý hồ sơ phụ huynh.
- Quản lý học sinh/con.
- Tạo yêu cầu dạy thử.
- Xem danh sách yêu cầu dạy thử của mình.
- Xem danh sách lớp của mình.
- Lấy bảng điều khiển tổng quan.
- Lấy bảng điều khiển chi tiết nếu gói theo dõi đang kích hoạt.
- Tạo đánh giá cho lớp đã kết thúc.
- Quản lý gói định kỳ của phụ huynh.

## API cho gia sư

- Quản lý hồ sơ gia sư.
- Lấy hồ sơ gia sư của chính mình để reload màn quản lý profile.
- Tải lên/cập nhật siêu dữ liệu video giới thiệu.
- Quản lý lịch rảnh/bận.
- Xem danh sách yêu cầu dạy thử được gửi đến mình.
- Chấp nhận/từ chối yêu cầu dạy thử.
- Xem danh sách lớp.
- Cập nhật trạng thái lớp.
- Tạo sổ đầu bài.
- Cập nhật sổ đầu bài của mình trong khoảng thời gian cho phép.
- Quản lý gói QR định kỳ.
- Quản lý tài khoản nhận tiền để tạo QR học phí.
- Tạo QR/link thanh toán.
- Đánh dấu QR record là đã thu.

## API thanh toán

- Tạo phiên thanh toán cho mở khóa từng hồ sơ.
- Tạo phiên thanh toán cho gói VIP mở khóa hồ sơ.
- Tạo phiên thanh toán cho gói theo dõi của phụ huynh.
- Tạo phiên thanh toán cho gói QR của gia sư.
- Nhận webhook thanh toán.
- Lấy trạng thái thanh toán.

Hành vi webhook (sau khi verify chữ ký + đối chiếu số tiền + chống trùng qua `webhook_events`):

- `paid` mở khóa từng hồ sơ -> tạo/kích hoạt `ProfileUnlock` (`expires_at = null`, vĩnh viễn).
- `paid` VIP -> kích hoạt `Subscription(parent_vip_unlock)`.
- `paid` gói theo dõi -> kích hoạt `Subscription(parent_tracking, scope_ref_id = student_id)`.
- `paid` gói QR gia sư -> kích hoạt `Subscription(tutor_qr)`.
- `failed/cancelled` -> không cấp quyền truy cập.
- `refunded` -> ghi `Refund`, thu hồi hoặc hết hạn quyền truy cập liên quan theo chính sách.
- Chữ ký sai/số tiền lệch -> **không cấp quyền**, ghi `webhook_events(invalid)` + cảnh báo admin.
- Cấp quyền chạy trong transaction, optimistic lock trên `payments.version`; side-effect (thông báo) qua outbox.

## API cho quản trị viên

- Xem dashboard user/registration/moderation/payment summary.
- Tìm, xem detail đã mask PII, suspend/reactivate user và thu hồi session.
- Xem/cập nhật paid-feature override theo user.
- Kiểm duyệt hồ sơ gia sư.
- Kiểm duyệt media và đánh giá.
- Ẩn/tạm khóa hồ sơ gia sư.
- Xem bản ghi thanh toán; tạo refund record theo chính sách đã chốt.
- Xem audit log, webhook event, outbox/notification event đã redaction.
- Đọc/cập nhật tài khoản VietQR nền tảng và bảng giá/bật tắt sản phẩm.
- Xử lý tranh chấp/báo cáo.

Mọi mutation admin nhạy cảm yêu cầu `reason`, role `admin`, audit log và không trả raw PII.

## Các lỗi cần chuẩn hóa

- `AUTH_REQUIRED`
- `CONSENT_REQUIRED`
- `PAYMENT_REQUIRED`
- `SUBSCRIPTION_EXPIRED`
- `UNLOCK_REQUIRED`
- `FORBIDDEN_ROLE`
- `INVALID_STATE_TRANSITION`
- `RESOURCE_NOT_FOUND`
- `VALIDATION_ERROR`
- `RATE_LIMITED`
