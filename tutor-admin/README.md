# tutor-admin

App quản trị vận hành nội bộ cho chủ dự án Kim Thanh Tutor.

Thư mục này hiện để trống về code để chủ dự án tự chọn stack/scaffold. README này giữ chỗ cho app admin và giúp repo track thư mục.

## Mục tiêu

- Thống kê user đăng ký vào hệ thống theo ngày, vai trò và trạng thái.
- Xem logs vận hành: audit logs, webhook events, outbox/notification events.
- Setup tài khoản thanh toán VietQR nền tảng.
- Setup phí sản phẩm: `single_unlock`, `parent_vip`, `parent_tracking`, `tutor_qr`.
- Phê duyệt/ẩn/khóa hồ sơ, media, review.
- Khóa/mở account user.
- Bật/tắt chức năng trả phí theo từng user.

## API Contract

Nguồn tham chiếu:

- `../ai-tasks/05-api-endpoints.md`: mục `Tutor Admin App / Operations`.
- `../ai-tasks/07-api-curl-user-flows.md`: `Flow 12 - Tutor Admin Control Center`.
- `../ai-tasks/06-verification.md`: script `verify-flow-12-tutor-admin-ops.sh`.

Trạng thái hiện tại: Flow 12 đã `Verified` bằng cURL end-to-end ngày 2026-07-14. API dashboard/users/logs/platform VietQR/pricing/paid-feature override đã có ở `tutor-api`.

## Nguyên tắc

- Chỉ dùng cho user role `admin`.
- Không hiển thị raw PII/secret/raw webhook payload.
- Mọi thay đổi nhạy cảm phải có reason và ghi `audit_logs`.
- Flow API phải verify bằng cURL trước khi đánh dấu `Verified`.
