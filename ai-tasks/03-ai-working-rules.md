# Quy Tắc Làm Việc Cho AI

## Khi bắt đầu một task code

1. Đọc file liên quan trong `ai-docs`. Với task kỹ thuật, đọc thêm `15` (quy ước chung), `12` (chịu tải), `13` (bảo mật), `14` (pháp lý dữ liệu).
2. Kiểm tra `04-open-questions.md` để biết có assumption nào cần chốt.
3. Nếu task chạm thanh toán, pháp lý, quyền riêng tư hoặc phân quyền, ưu tiên validation phía máy chủ + ownership check + audit log.
4. Không thêm scope ngoài MVP nếu không có yêu cầu.
5. Cập nhật tài liệu nếu phần triển khai làm thay đổi business rule.

## Quy ước kỹ thuật bắt buộc (từ `ai-docs/15`)

- ID = ULID; thời gian = UTC `timestamptz`; tiền = số nguyên VND; soft delete cho dữ liệu nghiệp vụ; enum có CHECK.
- Side-effect (thông báo/đồng bộ) đi qua outbox, không gọi đồng bộ trong request.
- Hành động tiền: idempotency + transaction + optimistic lock.
- Webhook: verify chữ ký + đối chiếu số tiền + chống trùng.
- Danh sách lớn: keyset pagination, không offset.
- Search: đọc cột denormalized, không AGG runtime; lọc trên bảng chuẩn hóa đã index.

## Quy ước đặt tên tạm thời

- Backend: `tutor-api`.
- App phụ huynh: `tutor-market`.
- Ứng dụng gia sư: `tutor-app`.
- Gói định kỳ bảng điều khiển cho phụ huynh: `parent_tracking`.
- VIP chợ gia sư cho phụ huynh: `parent_vip_unlock`.
- Gói định kỳ QR cho gia sư: `tutor_qr`.

## Nguyên tắc sản phẩm

- Khách chưa đăng nhập phải tìm gia sư được ngay.
- Paywall phải minh bạch, không đánh đố người dùng.
- Bảng điều khiển học tập chỉ mở khi có lớp và gói theo dõi hợp lệ.
- QR của gia sư không được diễn đạt như hệ thống đã thu hộ học phí.
- Đánh giá là tài sản quan trọng, phải có quyền sở hữu và kiểm duyệt.
- Consent pháp lý là bước chặn bắt buộc, không bỏ qua bằng giao diện.

## Định nghĩa hoàn tất cho một feature

- Có validation phía máy chủ.
- Có trạng thái lỗi/thành công rõ ràng.
- Có phân quyền theo vai trò.
- Có test hoặc checklist verify.
- Có cập nhật docs nếu business rule thay đổi.
- Nếu feature được dùng trong mock UI/UX, flow tương ứng trong `07-api-curl-user-flows.md` phải chạy được end-to-end hoặc ghi rõ blocker/status; nếu test failed, refactor/improve API để đạt business flow rồi cập nhật MD.
