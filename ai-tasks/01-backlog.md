# Backlog Sản Phẩm

Ghi chú trạng thái code ngày 2026-07-19:

- Các API phục vụ Flow 1-12 đã verify end-to-end bằng cURL; Flow 6/9 rerun ngày 2026-07-19 cho class detail/state/review; unit API mới nhất 131 test.
- Scaffold `TA-00`, `TM-00`, `AD-00` đã DONE; các dòng có ghi "API" không đồng nghĩa màn business frontend đã hoàn tất. Trạng thái chính xác nằm ở task list và `14-active-work.md`.

## Nhóm việc 1: Nền tảng

- ✅ Tạo monorepo pnpm cho `tutor-api` (NestJS), `tutor-market`, `tutor-app`, `tutor-admin`, package `contracts` (DTO/type/enum dùng chung).
- ✅ Thiết lập PostgreSQL + Prisma; áp quy ước ULID/UTC/tiền-nguyên/soft delete/enum-CHECK (`ai-docs/15`).
- ✅ Thêm Docker Compose verify local cho `tutor-api` + PostgreSQL: validate schema, `prisma db push`, kiểm tra DB bằng `psql`, kiểm tra API input/output bằng cURL (`ai-tasks/06-verification.md`).
- Thiết lập Redis (cache, rate limit, lock, BullMQ).
- ✅ Thiết lập lint/test/build cho workspace hiện có. Benchmark hot-path search (EXPLAIN ANALYZE trong CI) vẫn TODO.
- ✅ Thiết lập env config cơ bản; secret manager thật vẫn là việc triển khai hạ tầng.
- ✅ Thiết lập xác thực **email + password** (register → verify email qua link → login → quên/đặt lại mật khẩu) và **Google OAuth server-side**; Facebook OAuth là đích lâu dài. Đã bỏ OTP-SMS. Rate-limit/khóa tài khoản cơ bản cho auth.
- ✅ Tạo versioning cho legal consent (`legal_documents`/`legal_consents`).
- ✅ Dựng khung observability cơ bản: request_id, healthz/readyz; metric p95 search/webhook còn cần hạ tầng đo thật.

## Nhóm việc 1b: Xương sống kỹ thuật (chịu tải/bảo mật)

- ✅ API chuẩn hóa dữ liệu search (bảng con môn/khối/hình thức/khu vực) + index phục vụ filter; benchmark hot-path còn cần CI.
- ✅ Denormalize `rating_avg`/`rating_count`; cập nhật khi review published.
- ✅ Keyset pagination cho search + timeline.
- Outbox pattern + worker (BullMQ) cho notification/đồng bộ search/gọi provider.
- ✅ Idempotency-Key cho API tạo tiền; `idempotency_keys`.
- ✅ Verify webhook dev/SePay contract + đối chiếu số tiền + `webhook_events` chống trùng; provider production hardening còn cần môi trường thật.
- ✅ Optimistic lock/conditional state update (`version` hoặc expected-state CAS) cho các flow trial/lớp/subscription/payment hiện có; tiếp tục bắt buộc cho state machine mới.
- ✅ Rate limiting cơ bản cho auth/search/guest request/payment; Redis/distributed limit còn cần hạ tầng.
- ✅ API signed upload contract + moderation state. Object storage upload thật và worker quét virus/malware trước public vẫn TODO.
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

- ✅ `AD-00`: scaffold `tutor-admin`, workspace scripts, email/password admin, RBAC/consent/status gate, refresh cookie HttpOnly, shell và typed API client. `AD-01`–`AD-09` vẫn là màn nghiệp vụ/hardening TODO.
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

- Email giao dịch (verify email, đặt lại mật khẩu) gửi qua Resend; đã bỏ OTP-SMS.
- Thông báo yêu cầu dạy thử.
- Link kích hoạt khi yêu cầu được chấp nhận.
- Thông báo sổ đầu bài mới.
- Nhắc gói định kỳ sắp hết hạn.
- Nhắc đánh giá.

## Nhóm việc 9: Kiểm thử và nghiệm thu

- ✅ Unit test service/contract trọng yếu cho API.
- ✅ cURL user-flow contract Flow 1-12 trong `07-api-curl-user-flows.md` đã Verified (Flow 12 = `tutor-admin`).
- ✅ Test phân quyền theo vai trò ở service/flow chính.
- ✅ Test chuyển trạng thái ở service/flow chính.
- ✅ Test webhook thanh toán chống xử lý trùng ở API contract.
- ✅ Test quyền truy cập màn khóa trả phí.
- ✅ Test chặn/mở bảng điều khiển theo gói định kỳ.
- ✅ Test chặn tạo tài khoản bằng legal consent.
- CI chạy full unit test + cURL Flow 1-12 trên DB sạch.

## Nhóm việc 10: Hạ tầng & hardening (cuối hàng đợi, cần explicit approval)

Gom từ nợ kỹ thuật performance/bảo mật trong `15-perf-security-checklist.md` (mục "Nợ kỹ thuật đã biết"). Đặt **cuối hàng đợi**: chỉ nhận sau khi MVP FE/BE ổn định và có phê duyệt, vì cần hạ tầng thật (Redis, object storage, scanner, secret/CI provider). Mỗi task hoàn tất phải kéo các hạng mục checklist tương ứng sang 🟢 kèm evidence. Không nhét các task này vào một task feature.

| Task | Phạm vi | Hạng mục `15` | Phụ thuộc |
| --- | --- | --- | --- |
| INFRA-01 | Redis foundation: bật Redis là runtime dep (cache, distributed lock, hàng đợi BullMQ), config + `readyz` kiểm Redis | tiền đề E7/E8 | — |
| INFRA-02 | Outbox worker (BullMQ): dispatch `outbox_events` → notification/đồng bộ search/gọi provider; retry/backoff, DLQ, idempotent | E7, A08 | INFRA-01 |
| INFRA-03 | Distributed rate-limit + hardening request: Throttler dùng Redis storage, giới hạn payload size + timeout, khóa theo IP/user | E8, API4 | INFRA-01 |
| INFRA-04 | Media pipeline: object storage upload thật + worker quét virus/malware trước khi public, siết validate MIME/size, `scan_status` thật (bỏ `clean` cứng) | A10, API7 | INFRA-01 |
| INFRA-05 | Payment provider production: verify chữ ký provider thật (SePay/Casso), API key + IP allowlist prod, xử lý trả thiếu/thừa/sai nội dung, refund + thu hồi entitlement | API10, A08 | — |
| INFRA-06 | Data retention & quyền chủ thể dữ liệu (NĐ 13/2023): chính sách retention, ẩn danh khi xóa user, luồng truy cập/xóa/rút consent | C4, C6 | — |
| INFRA-07 | Perf benchmark & observability: `EXPLAIN ANALYZE` hot-path search/webhook trong CI, metric p95, cảnh báo | E2, E1 | — |
| INFRA-08 | Security process: dependency audit (`pnpm audit`/renovate) trong CI, threat-model review theo feature | A06, A04 | — |

Ghi chú: INFRA-05 bao trùm các mục còn mở của Nhóm việc 5 (trả thiếu/thừa/sai, hoàn tiền/thu hồi quyền); INFRA-02 bao trùm outbox của Nhóm việc 1b và worker thông báo của Nhóm việc 8; INFRA-06 bao trùm retention của Nhóm việc 1b.
