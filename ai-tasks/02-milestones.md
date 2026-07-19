# Các Mốc Triển Khai

Trạng thái code ngày 2026-07-19:

- Backend `tutor-api` có module cho Flow 1-12; Flow 4/5/6 rerun E2E ngày 2026-07-19 và unit mới nhất 126 test.
- Ba frontend đã hoàn tất scaffold (`TA-00`, `TM-00`, `AD-00`); tutor-app đã xong TA-01–TA-05, current task là `TA-06`.
- Các mốc dưới đây theo dõi sản phẩm tổng thể; API contract pass không đồng nghĩa frontend/provider/worker/production infrastructure đã hoàn tất.

## Mốc 0: Tài liệu sẵn sàng

Mục tiêu:

- Hoàn tất cấu trúc project và docs tham chiếu.

Hoàn tất khi:

- Có `tutor-api`, `tutor-market`, `tutor-app`, `tutor-admin`, `packages/contracts` trong pnpm workspace.
- Có `ai-docs`, `ai-tasks`.
- Có checklist verify bằng Docker Compose cho API/schema/database/cURL (`ai-tasks/06-verification.md`).
- Luồng nghiệp vụ đã được chuẩn hóa.
- Danh sách cải thiện đã rõ.
- Backlog và câu hỏi mở đã có.

## Mốc 1: Nền tảng kỹ thuật

Trạng thái: **đã có nền code/scaffold**, còn Redis/BullMQ, provider thật, CI benchmark và production observability.

Mục tiêu:

- Khởi tạo stack và chạy được khung ứng dụng/API.

Công việc:

- Chọn framework.
- Tạo khung ứng dụng/API.
- Lint/test/build.
- Docker Compose verify API + PostgreSQL + cURL.
- Env config.
- Quy ước dùng chung.

## Mốc 2: Xác thực và cổng pháp lý

Trạng thái: API parent/tutor đã có; admin auth/session `AD-00` đã có; tutor auth/consent `TA-01` đã DONE, market auth/consent còn `TM-03`.

Mục tiêu:

- Tạo tài khoản nhưng bị chặn bởi consent đúng business rule.

Công việc:

- Xác thực **email + password** (register → verify email qua link → login → quên/đặt lại mật khẩu) là phương thức hoạt động; **Google OAuth server-side** đã bật; Facebook OAuth là đích lâu dài. Đã bỏ OTP-SMS.
- Vai trò người dùng.
- API version pháp lý.
- Popup consent toàn màn hình.
- Lưu audit consent.

## Mốc 3: MVP chợ gia sư

Trạng thái: API đã có; `TM-00` mới hoàn tất nền SSR/SEO, business UI bắt đầu từ `TM-01`.

Mục tiêu:

- Khách chưa đăng nhập tìm và xem bản xem thử của gia sư; màn khóa trả phí hoạt động.

Công việc:

- Dữ liệu hồ sơ gia sư.
- Tìm kiếm/bộ lọc.
- Thẻ xem thử.
- Màn khóa trả phí ở trang chi tiết.
- Thanh toán mở khóa/VIP bằng giả lập hoặc nhà cung cấp thật.

## Mốc 4: Từ yêu cầu dạy thử đến lớp học

Mục tiêu:

- Phụ huynh gửi yêu cầu, gia sư chấp nhận, lớp được tạo.

Công việc:

- Form yêu cầu dạy thử.
- Hộp yêu cầu của gia sư.
- Chuyển trạng thái.
- Link kích hoạt.
- Hợp đồng lớp.

## Mốc 5: Sổ đầu bài và bảng điều khiển phụ huynh

Mục tiêu:

- Gia sư ghi sổ đầu bài, phụ huynh xem bảng điều khiển theo quyền.

Công việc:

- Tạo/xem/sửa/xóa sổ đầu bài.
- Bảng điều khiển tổng quan.
- Paywall gói theo dõi.
- Gói theo dõi định kỳ.
- Dòng thời gian và biểu đồ tăng trưởng.

## Mốc 6: Review và QR

Mục tiêu:

- Kết thúc lớp tạo đánh giá; gia sư dùng QR nếu đã mua gói.

Công việc:

- Kết thúc lớp.
- Review của phụ huynh.
- Trạng thái kiểm duyệt đánh giá.
- Gói QR cho gia sư.
- Tạo QR/link.
- Đánh dấu đã thu.

## Mốc 7: Làm chắc sản phẩm

Trạng thái: API operations và admin auth/shell đã có; các màn `AD-01`–`AD-09`, worker/provider thật và hardening xuyên app còn TODO.

Mục tiêu:

- Sẵn sàng demo/ra mắt nội bộ.

Công việc:

- Kiểm duyệt quản trị tối thiểu.
- Tutor Admin nội bộ: thống kê user, logs, cấu hình VietQR/phí, khóa account, bật/tắt paid feature theo user.
- Audit log.
- Trường hợp biên của thanh toán.
- Test phân quyền.
- Làm mượt trải nghiệm người dùng.
- Dữ liệu mẫu/demo.
