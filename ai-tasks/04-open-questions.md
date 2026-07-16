# Câu Hỏi Mở

Cần chốt trước khi triển khai thật.

## Đã chốt (không mở nữa)

- ✅ Mở khóa từng hồ sơ: **vĩnh viễn** với hồ sơ đó (`expires_at = null`).
- ✅ Gói theo dõi tính theo **từng học sinh** (`scope_ref_id = student_id`).
- ✅ Stack `tutor-api`: **NestJS + PostgreSQL + Prisma**.
- ✅ Chiến lược chịu tải: **PA2** (thiết kế đúng cho scale, bật hạ tầng theo ngưỡng) — xem `ai-docs/15`.
- ✅ Thanh toán: **VietQR (miễn phí)**. Học phí gia sư tự đối chiếu; doanh thu nền tảng dùng VietQR + webhook biến động số dư (**SePay** free tier / Casso) để auto-unlock.
- ✅ Có app quản trị tối thiểu `tutor-admin`; `AD-00` đã scaffold auth/RBAC/shell, màn nghiệp vụ theo AD-01–AD-09.
- ✅ Ba frontend giai đoạn 1 là web responsive; `tutor-market` dùng Next.js SSR/ISR, `tutor-app`/`tutor-admin` dùng Vite SPA.

## Giá và quyền truy cập

- VIP mở khóa hồ sơ có giới hạn số hồ sơ/ngày để tránh scrape không?
- Gói QR 30k/tháng có tự động gia hạn không? (schema đã có `auto_renew`)
- Giá thương mại cuối cùng (đơn vị đồng) cho từng sản phẩm. Backend đã có `product_pricing` do admin cấu hình và fallback kỹ thuật; UI luôn đọc giá server, không hard-code fallback thành quyết định kinh doanh.

## Provider thanh toán

- ✅ Đã chốt: **VietQR** + webhook biến động số dư (SePay free tier / Casso) cho doanh thu nền tảng.
- Tài khoản ngân hàng nền tảng để nhận doanh thu (bank + số TK) là gì?
- Chọn SePay (free tier) hay Casso? Hạn mức gói free có đủ không?
- Có cần hóa đơn/receipt không?
- Chính sách hoàn tiền cho từng gói là gì? (hoàn qua chuyển khoản tay hay tự động?)
- Xử lý ca trả thiếu/thừa/sai nội dung chuyển khoản thế nào?

## Chính sách liên hệ

- Khi nào phụ huynh được xem số điện thoại/thông tin liên hệ của gia sư?
- Khi nào gia sư được xem thông tin liên hệ của phụ huynh?
- Có cần ẩn liên hệ trong phần giới thiệu/video/đánh giá không?

## Kiểm duyệt

- Đánh giá có tự xuất bản hay chờ kiểm duyệt?
- Video giới thiệu có cần duyệt trước khi công khai không?
- Ai xử lý tranh chấp đánh giá?

## Pháp lý

- Bản Điều khoản sử dụng và Chính sách bảo mật chính thức nằm ở đâu?
- Có cần bắt người dùng đồng ý lại khi cập nhật version không?
- Có thu IP/user agent trong consent audit không?

## Chi tiết sản phẩm

- Gia sư có thể dạy nhiều học sinh trong cùng một lớp không?
- Phụ huynh có thể có nhiều con trong một tài khoản không? Mặc định tài liệu đã thiết kế là có.

## Kỹ thuật/hạ tầng (mới)

- Provider object storage cho media (S3/R2/Wasabi)?
- Dịch vụ quét virus cho upload (ClamAV self-host hay dịch vụ)?
- Ngưỡng bật Meilisearch/read-replica có khớp thực tế traffic dự kiến không? (mặc định ở `ai-docs/12`)
- Mức kiểm duyệt media/review: thủ công hay tự động (phát hiện SĐT/link)?
- Có mã hóa cột cho PII cao (số tài khoản, SĐT) ngay từ đầu không?
