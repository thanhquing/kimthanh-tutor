# tutor-app

Ứng dụng giáo viên/gia sư: quản lý hồ sơ, lịch dạy, lớp học, sổ đầu bài và QR thanh toán.

## Phạm vi

- Đăng ký bằng số điện thoại OTP và đồng ý điều khoản/chính sách.
- Tạo hồ sơ gia sư gồm trường, năm học, môn dạy, khối lớp, điểm thi/GPA nếu có, vùng miền, giọng nói, hình thức dạy và học phí tham khảo.
- Quản lý lịch bận để tránh trùng giờ dạy.
- Nhận và phản hồi yêu cầu dạy thử.
- Tạo/quản lý lớp sau khi chấp nhận.
- Ghi sổ đầu bài sau mỗi buổi học.
- Kết thúc hợp đồng/lớp để kích hoạt luồng đánh giá phụ huynh.
- Mua gói QR 30k/tháng để bật tính năng tạo QR/link thanh toán.
- Tự đối chiếu tiền học phí ngoài hệ thống và đánh dấu "đã thu".

## Nguyên tắc trải nghiệm người dùng

- Gia sư cần thấy việc cần làm hôm nay: lịch dạy, yêu cầu mới, sổ đầu bài cần nhập và gói QR sắp hết hạn.
- Form hồ sơ cần có trạng thái hoàn thành hồ sơ để đủ điều kiện xuất hiện trên chợ.
- Sau mỗi buổi học, sổ đầu bài phải nhập nhanh nhưng đủ dữ liệu cho bảng điều khiển phụ huynh.
- QR thanh toán phải nhắc rõ hệ thống không xác nhận tiền vào ngân hàng.

## Tài liệu nên đọc trước khi code

1. `../ai-docs/01-business-flow.md`
2. `../ai-docs/03-product-scope.md`
3. `../ai-docs/04-roles-and-permissions.md`
4. `../ai-docs/05-domain-model.md`
5. `../ai-docs/07-payments-and-monetization.md`
6. `../ai-docs/10-acceptance-criteria.md`
