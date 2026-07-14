# Backlog Sản Phẩm

Ghi chú trạng thái API ngày 2026-07-14:

- Các API phục vụ Flow 1-11 trong `07-api-curl-user-flows.md` đã được verify end-to-end bằng cURL.
- Các dòng có ghi "API" là backend contract đã có; phần giao diện/app frontend chỉ xem là hoàn tất khi `tutor-market`/`tutor-app` ráp xong màn tương ứng.

## Nhóm việc 1: Nền tảng

- ✅ Tạo monorepo pnpm cho `tutor-api` (NestJS), `tutor-market`, `tutor-app`, package `contracts` (DTO/type/enum dùng chung).
- ✅ Thiết lập PostgreSQL + Prisma; áp quy ước ULID/UTC/tiền-nguyên/soft delete/enum-CHECK (`ai-docs/15`).
- ✅ Thêm Docker Compose verify local cho `tutor-api` + PostgreSQL: validate schema, `prisma db push`, kiểm tra DB bằng `psql`, kiểm tra API input/output bằng cURL (`ai-tasks/06-verification.md`).
- Thiết lập Redis (cache, rate limit, lock, BullMQ).
- Thiết lập lint/test/build; benchmark hot-path search (EXPLAIN ANALYZE trong CI).
- ✅ Thiết lập env config cơ bản; secret manager thật vẫn là việc triển khai hạ tầng.
- ✅ Thiết lập xác thực Google/Facebook OAuth phía server; phone OTP còn là fallback/local với mã `272727`, hash mã, cooldown/rate-limit cơ bản.
- ✅ Tạo versioning cho legal consent (`legal_documents`/`legal_consents`).
- ✅ Dựng khung observability cơ bản: request_id, healthz/readyz; metric p95 search/webhook còn cần hạ tầng đo thật.

## Nhóm việc 1b: Xương sống kỹ thuật (chịu tải/bảo mật)

- ✅ API chuẩn hóa dữ liệu search (bảng con môn/khối/hình thức/khu vực) + index phục vụ filter; benchmark hot-path còn cần CI.
- ✅ Denormalize `rating_avg`/`rating_count`; cập nhật khi review published.
- ✅ Keyset pagination cho search + timeline.
- Outbox pattern + worker (BullMQ) cho notification/đồng bộ search/gọi provider.
- ✅ Idempotency-Key cho API tạo tiền; `idempotency_keys`.
- ✅ Verify webhook dev/SePay contract + đối chiếu số tiền + `webhook_events` chống trùng; provider production hardening còn cần môi trường thật.
- Optimistic lock (`version`) cho request/lớp/subscription/payment.
- ✅ Rate limiting cơ bản cho auth/search/guest request/payment; Redis/distributed limit còn cần hạ tầng.
- Signed upload media + quét virus + kiểm duyệt trước khi public.
- ✅ `audit_logs` cho hành động admin/nhạy cảm.
- Chính sách retention + ẩn danh khi xóa user (`ai-docs/14`).

## Nhóm việc 2: Chợ gia sư

- ✅ API tìm kiếm gia sư công khai.
- ✅ API thẻ xem thử gia sư.
- ✅ API trang chi tiết gia sư có màn khóa trả phí.
- Giao diện bộ lọc.
- ✅ API sắp xếp/phân trang.
- ✅ API checkout mở khóa từng hồ sơ.
- ✅ API thanh toán VIP/mở khóa hồ sơ qua checkout + webhook dev.
- Giao diện trạng thái mở khóa.

## Nhóm việc 3: App gia sư

- ✅ API đăng ký gia sư.
- ✅ API cổng pháp lý bắt buộc.
- ✅ API trình chỉnh sửa hồ sơ gia sư.
- ✅ API checklist đủ điều kiện xuất bản.
- ✅ API lịch rảnh/bận.
- ✅ API hộp yêu cầu dạy thử.
- ✅ API chấp nhận/từ chối yêu cầu.
- ✅ API danh sách lớp.
- ✅ API form sổ đầu bài.

## Nhóm việc 4: Luồng phụ huynh

- ✅ API link kích hoạt phụ huynh.
- ✅ API đăng ký phụ huynh.
- ✅ API hồ sơ học sinh/con.
- ✅ API form yêu cầu dạy thử.
- ✅ API trạng thái yêu cầu dạy thử của chính mình.
- ✅ API dashboard tổng quan của lớp.
- ✅ API checkout gói theo dõi.
- ✅ API dashboard chi tiết.
- ✅ API review sau khi lớp hoàn tất.

## Nhóm việc 5: Thanh toán (VietQR + webhook ngân hàng)

- ✅ API danh mục sản phẩm thanh toán.
- ✅ API tạo phiên thanh toán + sinh **QR VietQR** vào TK nền tảng kèm mã đơn duy nhất (`provider_reference`).
- ✅ API webhook biến động số dư kiểu SePay/Casso; production cần verify API key/IP allowlist theo provider thật.
- ✅ Đối chiếu mã đơn + số tiền; chống xử lý trùng (`webhook_events`); idempotency.
- ✅ API kích hoạt/hết hạn gói định kỳ theo entitlement/subscription.
- Xử lý ca trả thiếu/thừa/sai nội dung; hoàn tiền/thu hồi quyền.
- Fallback xác nhận tay theo sao kê (chỉ giai đoạn thử nghiệm).

## Nhóm việc 6: QR học phí cho gia sư (VietQR)

- ✅ API checkout gói QR cho gia sư.
- ✅ API chặn/mở tính năng QR theo gói.
- ✅ API cấu hình tài khoản nhận tiền của gia sư (`tutor_payout_accounts`).
- ✅ API sinh **QR VietQR** từ TK gia sư.
- ✅ API danh sách QR record.
- ✅ API đánh dấu đã thu (nền tảng không xác nhận dòng tiền).

## Nhóm việc 7: Quản trị và kiểm duyệt

- ✅ API kiểm duyệt hồ sơ gia sư.
- ✅ API kiểm duyệt đánh giá.
- ✅ API báo cáo đánh giá.
- ✅ API tạm ẩn/tạm khóa hồ sơ.
- ✅ API tra cứu thanh toán.
- ✅ API xem nhật ký kiểm toán.

## Nhóm việc 7b: Tutor Admin nội bộ

- ✅ Tạo thư mục root `tutor-admin` để chủ dự án tự scaffold app quản trị.
- ✅ API dashboard tổng quan: thống kê user đăng ký theo ngày/role/status, pending approval, doanh thu/payment summary.
- ✅ API danh sách user: lọc theo role/status/search, xem profile liên quan, xem trạng thái gói/quyền trả phí.
- ✅ API khóa/mở khóa account user ở mức `users.status`, có reason, revoke refresh token khi suspend và audit log.
- ✅ API logs vận hành: audit logs, webhook events, outbox/notification events, lọc theo entity/action/status.
- ✅ API setup tài khoản VietQR nền tảng: bank code, số tài khoản, chủ tài khoản, trạng thái active, mask PII khi đọc; checkout mới đọc account active.
- ✅ API setup phí sản phẩm: `single_unlock`, `parent_vip`, `parent_tracking`, `tutor_qr`, số tiền, kỳ hạn, bật/tắt bán; checkout đọc `product_pricing`.
- ✅ API bật/tắt chức năng trả phí theo user: override quyền mua/dùng paid feature, có reason, expires_at và audit log.
- ✅ API phê duyệt tập trung: dùng lại moderation queue hiện có và bổ sung capability cho tutor-admin UI.
- ✅ cURL user-flow `Tutor Admin Control Center` trong `07-api-curl-user-flows.md` đã Verified bằng `verify-flow-12-tutor-admin-ops.sh`.

## Nhóm việc 8: Thông báo

- Thông báo OTP/provider thật nếu bật phone login production; local hiện dùng mã `272727`, Google/Facebook là đường chính.
- Thông báo yêu cầu dạy thử.
- Link kích hoạt khi yêu cầu được chấp nhận.
- Thông báo sổ đầu bài mới.
- Nhắc gói định kỳ sắp hết hạn.
- Nhắc đánh giá.

## Nhóm việc 9: Kiểm thử và nghiệm thu

- ✅ Unit test service/contract trọng yếu cho API.
- ✅ cURL user-flow contract Flow 1-11 trong `07-api-curl-user-flows.md` đã Verified.
- ✅ cURL user-flow contract Flow 12 cho `tutor-admin` đã Verified.
- ✅ Test phân quyền theo vai trò ở service/flow chính.
- ✅ Test chuyển trạng thái ở service/flow chính.
- ✅ Test webhook thanh toán chống xử lý trùng ở API contract.
- ✅ Test quyền truy cập màn khóa trả phí.
- ✅ Test chặn/mở bảng điều khiển theo gói định kỳ.
- ✅ Test chặn tạo tài khoản bằng legal consent.
- CI chạy full unit test + cURL Flow 1-12 trên DB sạch.
