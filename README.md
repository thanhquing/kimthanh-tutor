# Kim Thanh Tutor

Không gian làm việc cho hệ thống gia sư giai đoạn 1.

## Cấu trúc dự án

- `tutor-api`: API phía máy chủ, xử lý nghiệp vụ, xác thực, thanh toán, mở khóa, lớp học, sổ đầu bài và thông báo.
- `tutor-market`: ứng dụng dành cho phụ huynh, gồm chợ gia sư và bảng điều khiển theo dõi học tập.
- `tutor-app`: ứng dụng dành cho giáo viên/gia sư, gồm hồ sơ, lịch dạy, yêu cầu dạy thử, sổ đầu bài và QR thanh toán.
- `tutor-admin`: thư mục dành cho app quản trị vận hành nội bộ; hiện để trống để chủ dự án tự chọn stack/scaffold.
- `packages/contracts`: DTO/type/enum dùng chung giữa API và các app.
- `ai-docs`: tài liệu tham chiếu về sản phẩm, nghiệp vụ, mô hình miền nghiệp vụ, API, pháp lý và tiêu chí nghiệm thu.
- `ai-tasks`: backlog, mốc triển khai và quy tắc làm việc cho AI/dev.

## Verify local bằng Docker Compose

Chạy API + PostgreSQL và kiểm tra schema/database/cURL:

```bash
docker compose up --build --abort-on-container-exit verify
```

Xem checklist chi tiết ở `ai-tasks/06-verification.md`.

Trạng thái API hiện tại: `tutor-api` đã có các module NestJS/Prisma cho auth, consent, search, tutor, parent, billing, trial, class, dashboard, review, QR và admin. Flow cURL 1-12 trong `ai-tasks/07-api-curl-user-flows.md` đã Verified ngày 2026-07-14.

## Nguyên tắc giai đoạn 1

- API backend đã qua bước tài liệu thuần túy; frontend apps/contracts và hạ tầng production tiếp tục được triển khai theo backlog.
- Tài liệu trong `ai-docs` là nguồn tham chiếu chính cho luồng nghiệp vụ.
- Tài liệu trong `ai-tasks` dùng để tách việc khi bắt đầu thiết kế và triển khai.
- Đăng ký/đăng nhập chính dùng Google/Facebook OAuth; OTP SĐT chỉ là fallback/local với mã `272727` cho tới khi có provider gửi OTP thật.
- Hệ thống không thu hộ học phí, không yêu cầu CCCD.
- Doanh thu đến từ mở khóa hồ sơ, gói VIP mở khóa hồ sơ, gói theo dõi bảng điều khiển và gói QR cho gia sư.

## Điểm đã điều chỉnh từ luồng nghiệp vụ gốc

- Bổ sung trạng thái rõ ràng cho gia sư, phụ huynh, yêu cầu dạy thử, lớp học, gói định kỳ, mở khóa và đánh giá.
- Tách bạch 2 loại trả phí của phụ huynh: mở khóa hồ sơ để chọn gia sư và gói theo dõi học tập sau khi có lớp.
- Bổ sung cơ chế bảo vệ đánh giá: chỉ phụ huynh có lớp đã kết thúc mới được đánh giá, có trạng thái kiểm duyệt/tố cáo.
- Bổ sung versioning cho điều khoản, chính sách bảo mật và consent.
- Bổ sung các trường cần cho tìm kiếm nhưng tránh biến thành thông tin nhạy cảm không cần thiết.
- Bổ sung luồng hết hạn, gia hạn, hủy gói và xử lý thanh toán thất bại.
