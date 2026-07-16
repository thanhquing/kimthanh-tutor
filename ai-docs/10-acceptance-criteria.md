# Tiêu Chí Nghiệm Thu

Dùng tài liệu này để kiểm tra MVP khi bắt đầu triển khai.

## Toàn hệ thống

- Không có tài khoản nào được kích hoạt nếu chưa đồng ý điều khoản/chính sách.
- Consent lưu đủ version và thời điểm.
- Không có luồng nào yêu cầu CCCD.
- Không có luồng nào thu hộ học phí giữa phụ huynh và gia sư.
- Mỗi thanh toán có trạng thái rõ ràng.
- Mỗi mở khóa/gói định kỳ chỉ kích hoạt sau khi thanh toán thành công.

## `tutor-market`

- Khách chưa đăng nhập vào ứng dụng thấy ngay tìm kiếm/danh sách gia sư.
- Khách chưa đăng nhập dùng được bộ lọc cơ bản và nâng cao.
- Thẻ xem thử không lộ đánh giá/video chi tiết.
- Trang chi tiết hiển thị màn khóa trả phí đúng nội dung bị khóa.
- Phụ huynh thanh toán mở khóa từng hồ sơ thành công thì xem được hồ sơ đã mua.
- Phụ huynh mua VIP còn hạn thì xem được chi tiết nhiều hồ sơ.
- Phụ huynh gửi được yêu cầu dạy thử.
- Phụ huynh chưa có tài khoản nhận được link kích hoạt sau khi gia sư chấp nhận.
- Bảng điều khiển miễn phí hiển thị tổng quan nhưng khóa dòng thời gian/biểu đồ tăng trưởng.
- Gói theo dõi đang kích hoạt thì mở dòng thời gian, bài tập, nhận xét và biểu đồ tăng trưởng.
- Hết hạn gói theo dõi thì khóa chi tiết nhưng không mất dữ liệu.
- Sau khi lớp kết thúc, phụ huynh có luồng đánh giá.

## `tutor-app`

- Gia sư đăng ký bằng Google/Facebook OAuth hoặc OTP SĐT fallback/local và bị chặn bởi popup pháp lý trước khi kích hoạt.
- Gia sư tạo được hồ sơ tối thiểu.
- Hồ sơ thiếu thông tin cần thiết không được xuất bản.
- Gia sư nhập được lịch bận/lịch có thể dạy.
- Gia sư nhận yêu cầu dạy thử mới.
- Gia sư chấp nhận/từ chối request đúng trạng thái.
- Khi chấp nhận request, hợp đồng lớp được tạo/liên kết.
- Gia sư ghi được sổ đầu bài cho lớp của mình.
- Gia sư không ghi được sổ đầu bài cho lớp không thuộc về mình.
- Gia sư mua gói QR thì bật được tính năng tạo QR.
- Hết hạn gói QR thì không tạo QR mới được.
- Gia sư đánh dấu "đã thu" mà không làm hệ thống tự nhận là đã thu qua ngân hàng.
- Gia sư kết thúc lớp thì kích hoạt yêu cầu đánh giá cho phụ huynh.

## `tutor-api`

- API tìm kiếm không yêu cầu xác thực.
- API chi tiết trả đúng dữ liệu xem thử/màn khóa trả phí theo quyền.
- API chi tiết bảng điều khiển kiểm tra gói theo dõi.
- API đánh giá kiểm tra lớp đã hoàn tất và quyền sở hữu của phụ huynh.
- API sổ đầu bài kiểm tra quyền sở hữu của gia sư.
- API webhook thanh toán **verify chữ ký + đối chiếu số tiền** và chống xử lý trùng.
- API tạo tiền nhận `Idempotency-Key`, double-submit không tạo 2 giao dịch.
- API chuyển trạng thái dùng optimistic lock, không cho double-accept/chuyển sai.
- Side-effect (thông báo/đồng bộ search) đi qua outbox, không mất khi lỗi.
- Gói theo dõi kiểm tra đúng theo từng học sinh (`scope_ref_id`).
- Guest gửi yêu cầu dạy thử qua `Lead`, convert đúng khi kích hoạt.
- API ghi nhật ký kiểm toán các hành động quan trọng.
- Admin failed-login counter không mất increment khi request song song; credential khóa đúng ngưỡng.
- Admin refresh rotation chỉ có một request claim token cũ; xung đột trong grace không phá phiên thắng, reuse sau grace thu hồi mọi refresh token còn hoạt động của user.
- Provision/rotate password admin thu hồi toàn bộ refresh token còn hoạt động.

## `tutor-admin`

- Chỉ email/password đã provision cho user role `admin` và status hợp lệ mới vào được console; không có đăng ký/quên mật khẩu public.
- Access token chỉ ở RAM, refresh token chỉ trong cookie HttpOnly `SameSite=Strict` (`Secure` ở production); reload khôi phục phiên qua API.
- 401/403/pending consent/suspended/expired và lỗi refresh tạm thời có state rõ ràng; không hiển thị hoặc log token.
- Route nghiệp vụ không render trước khi `/auth/me` xác nhận role/status/consent.
- Mutation suspend/reactivate, moderation, pricing, payment account và paid-feature override yêu cầu reason, được audit và không unmask raw PII.
- Password rotation làm các phiên refresh cũ hết hiệu lực.

## Phi chức năng

- Dữ liệu nhạy cảm không hiển thị trong bản xem thử công khai; media qua signed URL.
- Lỗi phân quyền trả mã lỗi nhất quán; ownership check ở phía máy chủ (chống IDOR).
- Các hành động quan trọng có validation phía máy chủ, không chỉ dựa vào giao diện.
- p95 tìm kiếm chợ gia sư < 200ms với dữ liệu quy mô thực tế (`12-non-functional-requirements.md`).
- Có rate limit cho OTP/search/guest request/payment.
- Dữ liệu trẻ em & PII tuân thủ `14-data-privacy-and-compliance.md` (consent, retention, ẩn danh khi xóa).
- Tài liệu API sau này phải map ngược được về mô hình miền nghiệp vụ trong `05-domain-model.md` và ERD `11`.
