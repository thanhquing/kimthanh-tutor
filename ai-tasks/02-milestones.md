# Các Mốc Triển Khai

Trạng thái API ngày 2026-07-14:

- Backend `tutor-api` đã có NestJS/Prisma modules cho Flow 1-11 và đã verify end-to-end bằng cURL theo `07-api-curl-user-flows.md`.
- Các mốc dưới đây vẫn dùng để theo dõi sản phẩm tổng thể; phần frontend/CI/hạ tầng provider thật có thể chưa hoàn tất dù API contract đã pass.

## Mốc 0: Tài liệu sẵn sàng

Mục tiêu:

- Hoàn tất cấu trúc project và docs tham chiếu.

Hoàn tất khi:

- Có `tutor-api`, `tutor-market`, `tutor-app`.
- Có `ai-docs`, `ai-tasks`.
- Có checklist verify bằng Docker Compose cho API/schema/database/cURL (`ai-tasks/06-verification.md`).
- Luồng nghiệp vụ đã được chuẩn hóa.
- Danh sách cải thiện đã rõ.
- Backlog và câu hỏi mở đã có.

## Mốc 1: Nền tảng kỹ thuật

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

Mục tiêu:

- Tạo tài khoản nhưng bị chặn bởi consent đúng business rule.

Công việc:

- Xác thực Google/Facebook OAuth là đường chính; phone OTP chỉ là fallback/local với mã `272727` cho tới khi có provider gửi OTP thật.
- Vai trò người dùng.
- API version pháp lý.
- Popup consent toàn màn hình.
- Lưu audit consent.

## Mốc 3: MVP chợ gia sư

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
