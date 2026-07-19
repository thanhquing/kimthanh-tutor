# Luồng Nghiệp Vụ Giai Đoạn 1

Snapshot triển khai 2026-07-16: API cho các hành trình Flow 1-12 đã có và giữ evidence cURL ngày 2026-07-14; ba frontend mới hoàn tất scaffold `TA-00`, `TM-00`, `AD-00`. Các bước UI trong tài liệu này là business target và chỉ được xem là hoàn tất theo task status trong `../ai-tasks/14-active-work.md`.

## 1. Tổng quan

Hệ thống gồm 4 ứng dụng runtime:

- `tutor-api`: API phía máy chủ.
- `tutor-market`: ứng dụng phụ huynh, gồm chợ gia sư và bảng điều khiển theo dõi học tập.
- `tutor-app`: ứng dụng giáo viên/gia sư, gồm quản lý công việc và tạo dữ liệu học tập.
- `tutor-admin`: console nội bộ cho vận hành user, moderation, payment/log và cấu hình nền tảng.

`packages/contracts` chia sẻ enum/type/DTO giữa API và ba frontend nhưng không phải một bề mặt sản phẩm độc lập.

Nền tảng không thu hộ học phí và không yêu cầu CCCD trong giai đoạn 1.

Nguồn doanh thu:

- Phụ huynh mở khóa từng hồ sơ gia sư.
- Phụ huynh mua VIP tháng để mở khóa nhiều hồ sơ.
- Phụ huynh mua gói theo dõi tháng để xem bảng điều khiển học tập chi tiết.
- Gia sư mua gói QR 30k/tháng.

## 2. Luồng phụ huynh: chợ gia sư

### 2.1 Khách chưa có tài khoản tìm kiếm miễn phí

Ngay khi vào `tutor-market`, phụ huynh có thể tìm kiếm gia sư mà không cần đăng ký.

Bộ lọc giai đoạn 1:

- Môn học.
- Khối lớp.
- Hình thức dạy: online, offline hoặc cả hai.
- Giới tính gia sư nếu gia sư tự khai báo.
- Vùng miền: Bắc, Trung, Nam.
- Giọng nói: Bắc, Nam, Trung, chuẩn phổ thông.
- Trình độ: sinh viên, đã tốt nghiệp, giáo viên hoặc khác.
- Trường/đơn vị đào tạo.
- Năm học hiện tại nếu là sinh viên.
- Điểm thi đại học/GPA nếu gia sư tự khai báo.
- Khoảng học phí tham khảo.
- Khu vực offline nếu có dạy trực tiếp.

Thẻ xem thử hiển thị:

- Ảnh đại diện.
- Họ tên hiển thị.
- Trường/trình độ.
- Môn dạy.
- Khối lớp dạy.
- Hình thức dạy.
- Khoảng học phí tham khảo.
- Một phần giới thiệu ngắn.

Thông tin bị khóa:

- Video giới thiệu.
- Điểm đánh giá sao.
- Nhận xét chi tiết từ phụ huynh đã học.
- Lịch sử dạy/lớp đã hoàn tất nếu có.
- Nút liên hệ trực tiếp nếu chưa đi qua luồng yêu cầu được cho phép.

### 2.2 Mở khóa hồ sơ

Khi bấm vào hồ sơ, ứng dụng hiển thị màn chi tiết với màn khóa trả phí.

Màn khóa trả phí cần nói rõ:

- Nội dung nào đang bị khóa.
- Giá mở khóa từng hồ sơ.
- Lựa chọn mua VIP tháng.
- Thời hạn quyền truy cập sau khi mở khóa.

Sau thanh toán thành công:

- Nếu mở khóa từng hồ sơ: phụ huynh được xem chi tiết hồ sơ đó.
- Nếu mua VIP: phụ huynh được xem chi tiết các hồ sơ trong thời hạn gói.
- Hệ thống lưu `ProfileUnlock` hoặc `Subscription`.

### 2.3 Gửi yêu cầu dạy thử

Sau khi mở khóa và thấy hồ sơ phù hợp, phụ huynh bấm "Gửi yêu cầu dạy thử".

Yêu cầu gồm:

- Học sinh/lớp học dự kiến.
- Môn học.
- Mục tiêu học.
- Hình thức online/offline.
- Lịch mong muốn.
- Lời nhắn.
- Thông tin liên hệ được phép chia sẻ theo quy định sản phẩm.

Nếu phụ huynh chưa có tài khoản (guest):

- Hệ thống cho nhập thông tin liên hệ tối thiểu và lưu vào thực thể `Lead` (không phải `ParentProfile`).
- `TrialRequest` gắn với `lead_id` (chưa có `parent_profile_id`).
- Tài khoản chính thức chỉ được tạo sau khi phụ huynh hoàn tất popup điều khoản/chính sách; khi đó `Lead` chuyển đổi (convert) thành `ParentProfile` và được gán vào request/lớp.
- Cần rate limit gửi yêu cầu của guest để chống spam gia sư (theo IP + SĐT lead).

## 3. Luồng gia sư

### 3.1 Đăng ký và hồ sơ

Gia sư đăng ký/đăng nhập bằng email + mật khẩu (đăng ký → xác minh email qua link → đăng nhập; quên mật khẩu qua email). Google OAuth (Authorization Code phía server) đã hoạt động; Facebook OAuth là đích lâu dài. Số điện thoại chỉ để liên hệ, không dùng để đăng nhập.

Bắt buộc:

- Hoàn tất popup điều khoản/chính sách.
- Nhập họ tên hiển thị.
- Nhập môn/khối lớp có thể dạy.
- Nhập hình thức dạy.
- Nhập học phí tham khảo.
- Nhập khu vực nếu dạy offline.

Khuyến khích:

- Ảnh đại diện.
- Video giới thiệu.
- Trường/trình độ.
- Năm học.
- Điểm thi/GPA.
- Giọng nói/vùng miền.
- Mô tả phong cách dạy.

Hồ sơ chỉ được đưa lên chợ khi đạt trạng thái `publishable`.

### 3.2 Quản lý lịch

Gia sư nhập lịch bận:

- Lịch học ở trường.
- Lịch dạy hiện tại.
- Khung giờ có thể dạy.

Hệ thống dùng lịch để:

- Cảnh báo trùng lịch khi có yêu cầu mới.
- Gợi ý khung giờ dạy thử.
- Giảm tình trạng phụ huynh gửi yêu cầu không khả thi.

### 3.3 Nhận yêu cầu dạy thử

Gia sư nhận yêu cầu từ phụ huynh.

Trong khi chính sách chia sẻ liên hệ còn là câu hỏi mở, inbox gia sư **không trả hoặc hiển thị** `contact_snapshot`/PII của `Lead`; chỉ hiển thị nội dung yêu cầu, lịch mong muốn và capability xử lý. Lịch mong muốn hiện là chuỗi tự do nên UI yêu cầu đối chiếu lịch rảnh/bận, không tự khẳng định có/không xung đột.

Trạng thái yêu cầu:

- `pending`: mới gửi.
- `accepted`: gia sư chấp nhận.
- `declined`: gia sư từ chối.
- `expired`: quá hạn phản hồi.
- `cancelled`: phụ huynh hủy.

Khi gia sư chấp nhận:

- Hệ thống tạo/liên kết `ClassContract` ở trạng thái `trial_accepted`.
- Hệ thống gửi link kích hoạt/đăng ký cho phụ huynh nếu phụ huynh chưa có tài khoản.
- Accept/decline/cancel dùng `expected_version` + compare-and-swap; client nhận trạng thái hiện tại trong lỗi `409` nếu thua race.

Khi quản lý lớp, API list/detail khóa theo thành viên lớp và trả capability theo actor. Gia sư mới được bắt đầu/tạm dừng/kết thúc sang `completed_pending_review`; phụ huynh chỉ có thể hủy ở trạng thái còn học. Mọi transition gửi `expected_version`; `completed` chỉ được tạo bởi review hợp lệ, không phải nút transition thủ công. Hình thức/lịch lấy từ yêu cầu học thử phải ghi rõ là **đề xuất**, không phải điều khoản hợp đồng.

### 3.4 Sổ đầu bài

Sau mỗi buổi học, gia sư ghi:

- Ngày giờ buổi học.
- Môn học.
- Nội dung đã học.
- Bài tập về nhà.
- Mức độ tiếp thu: tốt, bình thường, cần ôn.
- Nhận xét ngắn.
- Buổi tiếp theo nếu có.

Dữ liệu này tạo dòng thời gian và biểu đồ tăng trưởng cho bảng điều khiển phụ huynh.

### 3.5 QR thanh toán

Gia sư mua gói QR 30k/tháng để bật tính năng tạo QR/link thanh toán.

Khi đã kích hoạt:

- Gia sư nhập số tiền.
- Hệ thống tạo **QR VietQR** dựa trên tài khoản nhận tiền gia sư cấu hình (`tutor_payout_accounts`).
- Gia sư gửi QR/link ra kênh ngoài như Zalo.
- Hệ thống không xác nhận tiền vào ngân hàng (tiền về thẳng TK gia sư).
- Gia sư tự đối chiếu và bấm "Đã thu".

## 4. Luồng phụ huynh: bảng điều khiển học tập

### 4.1 Kích hoạt tài khoản và liên kết lớp

Sau khi gia sư chấp nhận yêu cầu:

- Phụ huynh nhận link kích hoạt.
- Phụ huynh tạo tài khoản bằng email + mật khẩu (số điện thoại chỉ để liên hệ).
- Phụ huynh bắt buộc hoàn tất popup điều khoản/chính sách.
- Tài khoản được liên kết với lớp/học sinh vừa chốt.

### 4.2 Bảng điều khiển miễn phí có giới hạn

Phụ huynh thấy:

- Tên học sinh/lớp.
- Gia sư đang dạy.
- Lịch học sắp tới nếu có.
- Một số thông tin tổng quan.

Dữ liệu chi tiết bị khóa:

- Dòng thời gian sổ đầu bài.
- Nhận xét chi tiết.
- Bài tập về nhà chi tiết.
- Biểu đồ tăng trưởng.
- Cảnh báo phần nội dung cần ôn.

### 4.3 Gói theo dõi tháng

Phụ huynh mua gói theo dõi 49k-89k/tháng **cho từng học sinh** (mỗi con một gói riêng, `scope_ref_id = student_id`).

Sau khi thanh toán thành công:

- Mở dòng thời gian chi tiết.
- Mở biểu đồ tăng trưởng theo mức độ tiếp thu.
- Mở danh sách bài tập về nhà.
- Mở lịch sử nhận xét.

Khi hết hạn:

- Chi tiết bảng điều khiển bị khóa lại.
- Dữ liệu cũ vẫn được lưu.
- Khi gia hạn thành công, dữ liệu hiển thị lại.

## 5. Đánh giá sau khi kết thúc lớp

Khi gia sư bấm "Kết thúc hợp đồng/lớp":

- Lớp chuyển sang `completed_pending_review`.
- Ứng dụng phụ huynh hiển thị yêu cầu đánh giá sao và nhận xét.
- Chỉ phụ huynh có liên kết với lớp đã kết thúc mới được đánh giá.
- Đánh giá có thể cần qua trạng thái kiểm duyệt trước khi hiển thị công khai.

Đánh giá sau khi hợp lệ sẽ trở thành nội dung bị khóa trong hồ sơ gia sư cho phụ huynh mới.

## 6. Popup pháp lý bắt buộc

Áp dụng cho cả ứng dụng phụ huynh và ứng dụng gia sư khi tạo tài khoản lần đầu.

Yêu cầu:

- Popup toàn màn hình.
- Chứa Điều khoản sử dụng và Chính sách bảo mật, hoặc liên kết đến bản đầy đủ.
- Không có nút đóng.
- Checkbox và nút đồng ý bị khóa lúc đầu.
- Người dùng phải cuộn nội dung đến 100%.
- Sau khi chạm đáy, checkbox và nút đồng ý mới được kích hoạt.
- Tài khoản chỉ tạo thành công sau khi bấm đồng ý.

Hệ thống phải lưu:

- User ID.
- Loại tài khoản.
- Version điều khoản/chính sách.
- Thời điểm đồng ý.
- IP/user agent nếu chính sách cho phép.
