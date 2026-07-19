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

- Đăng ký/đăng nhập bằng email + mật khẩu (Google OAuth phía server đã hoạt động; Facebook là đích lâu dài); SĐT chỉ để liên hệ.
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

### `tutor-admin`

- Đăng nhập email/password cho admin đã được provision ngoài UI; không có đăng ký/quên mật khẩu public.
- RBAC, consent/status gate và phiên refresh cookie HttpOnly.
- Dashboard vận hành, quản lý/trạng thái user, paid-feature override.
- Kiểm duyệt tutor/media/review, tra cứu payment/refund, logs vận hành.
- Cấu hình VietQR nền tảng và giá sản phẩm.

`AD-00` mới hoàn tất scaffold/auth/shell; các màn nghiệp vụ trên vẫn được theo dõi bằng `AD-01`–`AD-09`, không được coi là hoàn tất chỉ vì API đã có.

## Ngoài phạm vi giai đoạn 1

- Thu hộ học phí từ phụ huynh rồi chuyển cho gia sư.
- Xác minh CCCD/eKYC.
- Hệ thống tranh chấp học phí đầy đủ.
- Chat realtime đầy đủ trong ứng dụng.
- Video call/lớp học online tích hợp.
- AI matching tự động hoàn toàn.
- CRM/bảng điều khiển quản trị phức tạp ngoài console vận hành tối thiểu `tutor-admin`.
- Ứng dụng mobile native riêng nếu web/PWA đã đủ đáp ứng.

## Giả định sản phẩm cần chốt sau

- Giá thương mại cuối cùng, kỳ hạn/gia hạn và giới hạn chống scrape cho từng sản phẩm; backend hiện có cấu hình động và fallback kỹ thuật.
- Provider SMS/email.
- Mức kiểm duyệt thủ công hay tự động.
- Chính sách refund và xử lý trả thiếu/thừa/sai nội dung.

Đã chốt: single unlock vĩnh viễn; VietQR + webhook biến động số dư cho doanh thu nền tảng; web/PWA cho app người dùng; có console `tutor-admin` tối thiểu trong giai đoạn 1.
