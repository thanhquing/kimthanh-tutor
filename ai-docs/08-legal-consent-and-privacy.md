# Consent Pháp Lý Và Bảo Mật Dữ Liệu

## Popup bắt buộc

Áp dụng khi tạo tài khoản lần đầu cho:

- Phụ huynh.
- Gia sư.
- Admin nội bộ nếu user được provision ở trạng thái `pending_consent`; role admin không được bypass legal gate trước khi vào console.

Yêu cầu trải nghiệm người dùng:

- Hiển thị toàn màn hình.
- Không có nút đóng.
- Nội dung gồm Điều khoản sử dụng và Chính sách bảo mật, hoặc tóm tắt kèm link bản đầy đủ.
- Checkbox "Tôi đã đọc và đồng ý" bị disable ban đầu.
- Nút "Đồng ý" bị disable ban đầu.
- Người dùng phải cuộn đến cuối nội dung.
- Khi scroll đạt 100%, checkbox và nút mới được enable.
- Sau khi bấm đồng ý, tài khoản mới được kích hoạt.

## Dữ liệu cần lưu

- `user_id`
- `role_at_acceptance`
- `terms_version`
- `privacy_version`
- `accepted_at`
- `scroll_reached_bottom`
- `consent_method`
- `ip_address` nếu chính sách cho phép.
- `user_agent` nếu chính sách cho phép.

## Tài khoản chưa consent

Trạng thái:

- `pending_consent`

Hạn chế:

- Không được gửi yêu cầu dạy thử chính thức.
- Không được chấp nhận dạy thử.
- Không được tạo hồ sơ ở trạng thái xuất bản.
- Không được mua gói/tạo thanh toán chính thức nếu nhà cung cấp thanh toán yêu cầu tài khoản đã kích hoạt.

## Nguyên tắc bảo mật dữ liệu

- Không thu CCCD trong giai đoạn 1.
- Chỉ thu dữ liệu cần cho matching, vận hành lớp, thanh toán gói dịch vụ và thông báo.
- Các trường như điểm thi, GPA, giới tính, giọng nói, trường học nên là tự khai báo.
- Nếu thông tin chưa xác minh, giao diện cần tránh diễn đạt như đã được nền tảng xác thực.
- Không hiển thị số điện thoại/email trực tiếp ở bản xem thử công khai.

## Nội dung cần kiểm soát

- Hồ sơ gia sư.
- Mô tả phong cách dạy.
- Video giới thiệu.
- Review/nhận xét.
- Nội dung có số điện thoại/email/link ngoài nếu vi phạm chính sách sản phẩm.

## Khi cập nhật điều khoản

- Tạo version mới.
- Người dùng hiện tại có thể bị yêu cầu đồng ý lại.
- Lưu consent mới, không ghi đè consent cũ.
