# Phạm Vi Sản Phẩm MVP

## Mục tiêu giai đoạn 1

Tạo nền tảng hai mặt:

- Phụ huynh tìm, đánh giá, mở khóa, gửi yêu cầu dạy thử và theo dõi học tập của con.
- Gia sư tạo hồ sơ, nhận yêu cầu, quản lý lớp, ghi sổ đầu bài và tạo QR thanh toán nếu trả phí.

## Trong phạm vi

### `tutor-market`

- Tìm kiếm gia sư không cần đăng nhập.
- Bộ lọc nâng cao cơ bản.
- Thẻ xem thử và trang chi tiết hồ sơ có màn khóa trả phí.
- Thanh toán mở khóa hồ sơ/VIP.
- Gửi yêu cầu dạy thử.
- Đăng ký/kích hoạt tài khoản phụ huynh.
- Popup điều khoản/chính sách bắt buộc.
- Dashboard miễn phí có giới hạn.
- Gói theo dõi tháng.
- Dòng thời gian, bài tập, nhận xét và biểu đồ tăng trưởng.
- Đánh giá sau khi lớp kết thúc.

### `tutor-app`

- Đăng ký/đăng nhập Google/Facebook; OTP SĐT chỉ là fallback/local.
- Popup điều khoản/chính sách bắt buộc.
- Tạo và quản lý hồ sơ gia sư.
- Quản lý lịch bận.
- Nhận/chấp nhận/từ chối yêu cầu dạy thử.
- Quản lý lớp.
- Ghi sổ đầu bài.
- Mua gói QR.
- Tạo QR/link thanh toán.
- Đánh dấu đã thu.
- Kết thúc lớp.

### `tutor-api`

- Xác thực và vai trò.
- Domain hồ sơ, tìm kiếm, mở khóa và gói định kỳ.
- Yêu cầu dạy thử và hợp đồng lớp.
- Lesson log/sổ đầu bài.
- Review.
- Payment record.
- Notification.
- Legal consent.
- Audit log tối thiểu.

## Ngoài phạm vi giai đoạn 1

- Thu hộ học phí từ phụ huynh rồi chuyển cho gia sư.
- Xác minh CCCD/eKYC.
- Hệ thống tranh chấp học phí đầy đủ.
- Chat realtime đầy đủ trong ứng dụng.
- Video call/lớp học online tích hợp.
- AI matching tự động hoàn toàn.
- CRM/bảng điều khiển quản trị phức tạp.
- Ứng dụng mobile native riêng nếu web/PWA đã đủ đáp ứng.

## Giả định sản phẩm cần chốt sau

- Mở khóa từng hồ sơ là vĩnh viễn hay có thời hạn.
- Giá cụ thể cho mở khóa, VIP và theo dõi.
- Provider thanh toán.
- Provider SMS/email.
- Mức kiểm duyệt thủ công hay tự động.
- Có cần ứng dụng quản trị riêng trong giai đoạn 1 hay dùng thao tác phía máy chủ/no-code nội bộ.
