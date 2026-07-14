# tutor-api

API phía máy chủ cho hệ thống Kim Thanh Tutor.

## Stack & yêu cầu

- **Node.js >= 18.12** (khuyến nghị 20/24). NestJS 10 + PostgreSQL 15+ + Prisma.
- Xem kiến trúc/quy ước ở `../ai-docs/15-architecture-and-tech-stack.md`.

## Chạy dự án

```bash
pnpm install
cp .env.example .env            # sửa DATABASE_URL, secrets, VietQR/SePay
pnpm prisma:generate            # sinh Prisma client
npx prisma db push              # tạo bảng local khi chưa có migrations chính thức
pnpm start:dev                  # http://localhost:3000/api/v1
```

Khi repo có `prisma/migrations` chính thức, đổi bước dựng schema sang `pnpm prisma:migrate` khi dev hoặc `pnpm prisma:deploy` khi deploy. Nếu chạy riêng thư mục `tutor-api` bằng npm vẫn được, nhưng workspace chuẩn của repo là pnpm.

Health: `GET /healthz`, `GET /readyz` (readyz kiểm tra DB).

## Verify bằng Docker Compose

Từ thư mục gốc repo:

```bash
docker compose up --build --abort-on-container-exit verify
```

Compose dựng PostgreSQL, build API image, chạy `prisma db push`, sau đó script `tutor-api/scripts/verify-api-io.sh` kiểm tra schema, DB bằng `psql`, health/readyz và luồng OTP fallback/local bằng cURL. Non-production OTP dùng mã cố định `272727`; Google/Facebook OAuth là đường đăng ký/đăng nhập chính và cần provider token thật để E2E ngoài môi trường mock/unit test. Checklist chi tiết nằm ở `../ai-tasks/06-verification.md`.

## Trạng thái hiện tại

- Đã có cấu hình dự án, **Prisma schema đầy đủ theo ERD** (`prisma/schema.prisma`) và hạ tầng cross-cutting: config, PrismaModule, guard JWT + vai trò, filter lỗi chuẩn, keyset pagination, request-id, util ULID/hash, health.
- Các module nghiệp vụ trong catalog đã có service/controller/test trọng yếu: `auth`, `consent`, `search`, `tutors`, `parents`, `billing`, `trials`, `classes`, `dashboard`, `reviews`, `qr`, `notifications`, `admin`.
- Flow cURL 1-12 trong `../ai-tasks/07-api-curl-user-flows.md` đã Verified ngày 2026-07-14; full unit test API pass 79/79.
- Auth hiện dùng Google/Facebook OAuth làm đường chính; OTP SĐT là fallback/local với mã `272727` cho tới khi chốt provider gửi OTP production.
- Side-effect nền như gửi OTP thật, worker outbox/notification, object storage thật, provider OAuth production hardening và provider webhook thật vẫn là phần tích hợp hạ tầng.
- Danh mục endpoint chi tiết, quyền và quy tắc nghiệm thu nằm ở `../ai-tasks/05-api-endpoints.md`.

## Quy ước code (bắt buộc)

Xem `../ai-tasks/03-ai-working-rules.md` và `../ai-docs/15`: ULID, UTC, tiền số-nguyên VND, soft delete, enum-CHECK, outbox cho side-effect, idempotency + optimistic lock cho tiền, verify webhook, keyset pagination, ownership check (fail closed).

## Phạm vi

- Quản lý tài khoản phụ huynh và gia sư.
- Lưu hồ sơ gia sư, bộ lọc tìm kiếm, video giới thiệu và đánh giá.
- Xử lý màn khóa trả phí, mở khóa hồ sơ, gói VIP, gói theo dõi bảng điều khiển và gói QR gia sư.
- Quản lý yêu cầu dạy thử, chấp nhận lớp, hợp đồng lớp học và kết thúc lớp.
- Lưu sổ đầu bài, bài tập về nhà, mức độ tiếp thu, dòng thời gian và dữ liệu biểu đồ.
- Gửi thông báo/link kích hoạt qua email/SMS hoặc nhà cung cấp tương đương.
- Lưu consent pháp lý khi đăng ký tài khoản.

## Ranh giới trách nhiệm

- API không thu hộ học phí giữa phụ huynh và gia sư.
- API chỉ hỗ trợ tạo QR/link thanh toán theo thông tin gia sư nhập và ghi nhận trạng thái "gia sư đã đánh dấu đã thu".
- API không lưu CCCD trong giai đoạn 1.
- API phải ghi nhật ký kiểm toán cho consent, thanh toán, mở khóa, đánh giá và thay đổi trạng thái lớp.

## Tài liệu nên đọc trước khi code

1. `../ai-docs/00-index.md`
2. `../ai-docs/01-business-flow.md`
3. `../ai-docs/05-domain-model.md`
4. `../ai-docs/06-api-contract.md`
5. `../ai-docs/07-payments-and-monetization.md`
6. `../ai-docs/08-legal-consent-and-privacy.md`
7. `../ai-docs/10-acceptance-criteria.md`
