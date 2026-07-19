# Thông Báo Và Luồng Trạng Thái

## Kênh thông báo

Giai đoạn 1 có thể dùng:

- Trong ứng dụng.
- Email.
- SMS.
- Push nếu ứng dụng/PWA hỗ trợ.

## Sự kiện cần thông báo

### Cho phụ huynh

- Thanh toán mở khóa thành công/thất bại.
- Gia sư đã nhận yêu cầu dạy thử.
- Gia sư chấp nhận/từ chối yêu cầu.
- Link kích hoạt tài khoản/lớp.
- Gia sư đã ghi sổ đầu bài mới.
- Gói theo dõi sắp hết hạn/đã hết hạn.
- Lớp đã kết thúc và cần đánh giá.

### Cho gia sư

- Có yêu cầu dạy thử mới.
- Phụ huynh hủy yêu cầu.
- Lớp được kích hoạt.
- Gói QR sắp hết hạn/đã hết hạn.
- QR/link thanh toán đã tạo.
- Phụ huynh đã đánh giá.
- Review bị báo cáo/kiểm duyệt.

### Cho admin

- Hồ sơ/video cần kiểm duyệt.
- Review bị báo cáo.
- Thanh toán bất thường/hoàn tiền.

Đây là danh sách sự kiện mục tiêu. Tại snapshot 2026-07-16, notification in-app cho parent/tutor và outbox emit đã có, nhưng worker email/SMS/push chưa wire; operational notification inbox riêng cho admin chưa có endpoint và đang chờ quyết định `AD-08`. Admin hiện theo dõi qua moderation/log/payment screens/API.

## Luồng trạng thái `TrialRequest`

Trạng thái:

- `pending`
- `accepted`
- `declined`
- `expired`
- `cancelled`

Chuyển trạng thái:

- Phụ huynh/hệ thống tạo -> `pending`
- Gia sư chấp nhận -> `accepted`
- Gia sư từ chối -> `declined`
- Phụ huynh hủy -> `cancelled`
- Hệ thống quá hạn -> `expired`

Quy tắc:

- Chỉ yêu cầu ở trạng thái `pending` mới được chấp nhận/từ chối/hủy.
- Khi `accepted`, tạo hoặc cập nhật `ClassContract`.

## Luồng trạng thái `ClassContract`

Trạng thái:

- `trial_accepted`
- `active`
- `paused`
- `completed_pending_review`
- `completed`
- `cancelled`

Chuyển trạng thái đề xuất:

- TrialRequest accepted -> `trial_accepted`
- Lớp bắt đầu học thật -> `active`
- Tạm dừng -> `paused`
- Gia sư kết thúc lớp -> `completed_pending_review`
- Phụ huynh đánh giá hợp lệ -> `completed`
- Hủy trước/giữa quá trình -> `cancelled`

Quy tắc:

- Chỉ gia sư gắn với lớp mới được tạo sổ đầu bài.
- Chỉ phụ huynh gắn với lớp mới được xem bảng điều khiển.
- Chỉ lớp `completed_pending_review` hoặc `completed` mới có đánh giá.
- Transition là actor-specific và CAS theo `status+version`: tutor bắt đầu/tạm dừng/tiếp tục/kết thúc; parent chỉ hủy khi lớp chưa kết thúc. Không cho client transition trực tiếp sang `completed`; review hợp lệ thực hiện bước đó.

## Luồng trạng thái `Subscription`

Trạng thái:

- `pending_payment`
- `active`
- `past_due`
- `expired`
- `cancelled`
- `refunded`

Quy tắc:

- Trạng thái `active` cho phép dùng tính năng.
- `past_due` có thể cho grace period nếu product quyết định.
- `expired/cancelled/refunded` khóa tính năng nhưng không xóa dữ liệu.

## Luồng trạng thái `Review`

Trạng thái:

- `pending_moderation`
- `published`
- `hidden`
- `disputed`

Quy tắc:

- Đánh giá mới có thể vào `pending_moderation` hoặc `published` tùy chính sách.
- Gia sư có thể báo cáo -> `disputed`.
- Admin có thể xuất bản hoặc ẩn đánh giá.
