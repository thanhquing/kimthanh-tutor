# Vai Trò Và Quyền Truy Cập

## Mô hình phân quyền

- **RBAC** theo vai trò cho khả năng thô + **ownership check** cho mọi tài nguyên có chủ (kiểm tra tài nguyên thuộc về user gọi trước khi đọc/ghi).
- Kiểm tra ở **phía máy chủ**, **fail closed** (không chắc thì từ chối). Không tin `id` client gửi để suy ra quyền (chống IDOR).
- Mọi hành động admin/nhạy cảm ghi `audit_logs`.
- Chi tiết kỹ thuật: `13-security-and-threat-model.md`.

## Vai trò

- `guest`: khách chưa đăng nhập.
- `parent`: phụ huynh đã có tài khoản.
- `tutor`: gia sư đã có tài khoản.
- `admin`: quản trị viên nội bộ.
- `system`: tác vụ tự động của phía máy chủ.

## Khách chưa đăng nhập

Được phép:

- Tìm kiếm gia sư.
- Xem thẻ ở chế độ xem thử.
- Xem trang chi tiết có màn khóa trả phí.
- Bắt đầu thanh toán mở khóa nếu luồng cho phép tạo phiên tạm.
- Để lại thông tin tối thiểu để gửi yêu cầu dạy thử nếu sản phẩm cho phép.

Không được phép:

- Xem đánh giá/video bị khóa khi chưa mở khóa/VIP.
- Xem bảng điều khiển học tập.
- Gửi đánh giá.
- Quản lý lớp.

## Phụ huynh

Được phép:

- Quản lý thông tin phụ huynh và học sinh.
- Tìm/mua quyền mở khóa/VIP.
- Gửi yêu cầu dạy thử.
- Xem lớp được liên kết.
- Mua gói theo dõi.
- Xem bảng điều khiển chi tiết nếu gói còn hiệu lực.
- Đánh giá lớp đã kết thúc.

Không được phép:

- Sửa sổ đầu bài của gia sư.
- Đánh giá gia sư nếu không có lớp đã kết thúc.
- Xem dữ liệu lớp/học sinh của phụ huynh khác.

## Gia sư

Được phép:

- Tạo/sửa hồ sơ của mình.
- Cấu hình lịch bận.
- Nhận và phản hồi yêu cầu dạy thử.
- Quản lý lớp của mình.
- Ghi sổ đầu bài.
- Mua và dùng gói QR.
- Tạo QR/link thanh toán khi gói QR còn hiệu lực.
- Đánh dấu đã thu học phí.
- Kết thúc lớp.
- Báo cáo đánh giá không phù hợp.

Không được phép:

- Sửa đánh giá của phụ huynh.
- Xem bảng điều khiển riêng của phụ huynh ngoài dữ liệu lớp mình dạy.
- Xem thông tin thanh toán mở khóa/VIP của phụ huynh trừ khi cần cho vận hành lớp.

## Quản trị viên

Được phép:

- Ẩn/hiện/tạm khóa hồ sơ.
- Kiểm duyệt đánh giá/video/nội dung.
- Xử lý báo cáo.
- Xem bản ghi thanh toán và mở khóa/gói định kỳ.
- Xử lý hoàn tiền theo chính sách.
- Xem nhật ký kiểm toán.

Cần giới hạn:

- Mọi hành động admin quan trọng phải có nhật ký kiểm toán.
- Không dùng admin để sửa dữ liệu học tập tùy tiện nếu không có lý do.

## Ma trận quyền rút gọn

| Chức năng | Khách | Phụ huynh | Gia sư | Admin |
| --- | --- | --- | --- | --- |
| Tìm kiếm gia sư | Có | Có | Có | Có |
| Xem bản xem thử | Có | Có | Có | Có |
| Xem đánh giá/video bị khóa | Chỉ khi đã trả phí | Chỉ khi đã trả phí | Chỉ hồ sơ của mình | Có |
| Gửi yêu cầu dạy thử | Giới hạn | Có | Không | Hỗ trợ |
| Chấp nhận yêu cầu dạy thử | Không | Không | Gia sư được gửi yêu cầu | Hỗ trợ |
| Ghi sổ đầu bài | Không | Không | Gia sư của lớp | Hỗ trợ |
| Xem bảng điều khiển theo dõi | Không | Con của mình + đã trả phí | Tóm tắt lớp mình dạy | Có |
| Viết đánh giá | Không | Chỉ lớp đã hoàn tất | Không | Chỉ kiểm duyệt |
| Tạo QR thanh toán | Không | Không | Gia sư có gói QR | Không |
