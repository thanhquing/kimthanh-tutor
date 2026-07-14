# Kiến Trúc Và Stack Kỹ Thuật

Tài liệu này chốt stack, ranh giới module, các quy ước chung và **chiến lược chịu tải**. Đây là tài liệu "sống còn": mọi doc khác (ERD, API, NFR, security) đều tham chiếu các quy ước ở đây.

## 1. Quyết định kiến trúc đã chốt

| Hạng mục | Quyết định | Lý do |
| --- | --- | --- |
| Backend | **NestJS (TypeScript)** | Có cấu trúc module/DI rõ, dễ tuyển ở VN, chia sẻ type với 2 app frontend. |
| Database | **PostgreSQL 15+** | Đủ mạnh cho chợ gia sư giai đoạn 1: JSONB, mảng, GIN, full-text search, partitioning gốc. |
| ORM | **Prisma** | Type-safe, migration rõ ràng, dễ audit schema. Xem lưu ý ở mục 6. |
| Cache/khóa/queue nhẹ | **Redis** | Cache đọc, rate limit, distributed lock, hàng đợi job nhẹ (BullMQ). |
| Frontend | `tutor-market` (phụ huynh), `tutor-app` (gia sư) — **web responsive/PWA** giai đoạn 1 | Tránh chi phí native sớm; PWA push đủ cho thông báo. |
| Thanh toán | **VietQR** (NAPAS 247) — miễn phí | Học phí gia sư: tạo QR vào TK gia sư, tự đối chiếu. Doanh thu nền tảng: VietQR vào TK nền tảng + webhook biến động số dư (**SePay** free tier / Casso) để auto-unlock. Xem `07-payments-and-monetization.md`. |
| Tổ chức mã | **Monorepo** (pnpm workspace) | Chia sẻ package `contracts` (DTO/type/enum) giữa API và 2 app → không lệch hợp đồng. |

> Stack này khớp lựa chọn của chủ sản phẩm (NestJS + PostgreSQL + Prisma). Nếu thay stack, phải cập nhật lại doc này trước khi code.

## 2. Chiến lược chịu tải: PA2 — "thiết kế đúng cho scale, bật hạ tầng theo ngưỡng"

Nguyên tắc: **thiết kế (schema, ranh giới, cách viết query) phải đúng cho quy mô lớn ngay từ đầu** vì sửa sau rất đắt; còn **hạ tầng nặng (search engine, read-replica, sharding) chỉ bật khi chạm ngưỡng đo được**, vì thiết kế đã đúng nên chỉ cần "bật thêm", không phải viết lại.

### Bảng ngưỡng nâng cấp (scaling triggers)

| Tín hiệu đo được | Ngưỡng bật | Hành động | Đã sẵn sàng trong thiết kế? |
| --- | --- | --- | --- |
| Số hồ sơ gia sư published | > ~50k **hoặc** p95 search > 200ms | Bật **Meilisearch/OpenSearch**, đồng bộ từ Postgres qua outbox | Có — search đã tách interface `SearchPort`, Postgres FTS là adapter mặc định |
| CPU đọc DB cao, nhiều query đọc | Read QPS > ~70% capacity primary | Thêm **read-replica**, route query đọc-thuần sang replica | Có — repository tách read/write |
| Bảng `lesson_logs`/`notifications`/`audit_logs` | > ~50M dòng/bảng | **Partition theo thời gian** (range monthly) + retention | Có — các bảng này thiết kế partition-ready (khóa gồm thời gian) |
| Job async (notification, moderation, sync search) | Backlog tăng | Tách **worker service** riêng, scale ngang | Có — dùng outbox + BullMQ ngay từ đầu |
| Traffic đột biến theo mùa (đầu năm học) | Dự báo | Scale ngang API (stateless) sau load balancer | Có — API stateless, session/JWT không dính máy |

**Cái phải làm đúng NGAY (miễn phí, nằm trong thiết kế):** xem mục 4.

## 3. Ranh giới module (NestJS modules) — theo bounded context

Chia theo miền nghiệp vụ, không chia theo tầng kỹ thuật. Mỗi module sở hữu bảng của mình; module khác truy cập qua service, không query chéo bảng.

- `auth` — Google/Facebook OAuth, OTP fallback/local, phiên, JWT, vai trò.
- `consent` — legal documents versioning, ghi nhận đồng ý.
- `users` — `users`, hồ sơ vai trò gốc.
- `parents` — parent profile, students.
- `tutors` — tutor profile, availability, media, payout account.
- `search` — đọc chợ gia sư (SearchPort: Postgres FTS mặc định, Meili adapter khi cần).
- `marketplace-access` — profile unlock, kiểm tra quyền xem chi tiết.
- `billing` — payments, subscriptions, refunds, webhook, idempotency.
- `trials` — trial requests + leads (guest).
- `classes` — class contracts, state machine.
- `lesson-logs` — sổ đầu bài.
- `dashboard` — tổng hợp đọc cho phụ huynh (theo gói tracking).
- `reviews` — review + moderation + report.
- `qr-payments` — QR record của gia sư.
- `notifications` — outbox consumer, đa kênh.
- `moderation` — kiểm duyệt hồ sơ/video/review.
- `admin` — thao tác quản trị + audit.
- `platform` — cross-cutting: audit log, outbox, rate limit, feature flags.

## 4. Quy ước chung bắt buộc (mọi bảng/API tuân theo)

Đây là phần "làm đúng ngay từ đầu" quyết định khả năng chịu tải và bảo trì.

### 4.1 Định danh (ID)
- PK dùng **ULID** (hoặc UUIDv7) lưu dạng `char(26)`/`uuid`, **KHÔNG** dùng UUIDv4 ngẫu nhiên.
- Lý do: ULID/UUIDv7 sắp theo thời gian → index B-tree không bị phân mảnh khi ghi lớn (insert locality), tốt hơn hẳn UUIDv4 ở tải cao. Không lộ số lượng bản ghi như auto-increment.

### 4.2 Thời gian
- **Lưu mọi mốc thời gian ở UTC**, kiểu `timestamptz`. Quy đổi sang `Asia/Ho_Chi_Minh` ở tầng hiển thị.
- Mọi bảng có `created_at`; bảng có sửa đổi có thêm `updated_at`.

### 4.3 Tiền tệ
- Lưu **số nguyên theo đơn vị nhỏ nhất** (VND: đồng, không thập phân) — kiểu `bigint`. **Không dùng float cho tiền.**
- Luôn kèm `currency` (mặc định `VND`).

### 4.4 Xóa mềm & bất biến
- Dữ liệu người dùng/nghiệp vụ: **soft delete** bằng `deleted_at timestamptz null` (giữ dữ liệu, phục vụ audit/khôi phục), không xóa cứng.
- Dữ liệu tài chính (`payments`, `refunds`, `audit_logs`, `legal_consents`, `outbox_events`): **append-only**, không sửa/xóa; trạng thái thay đổi bằng bản ghi mới, không ghi đè lịch sử.

### 4.5 Enum & trạng thái
- Enum lưu dạng `text` **có CHECK constraint** (hoặc Postgres enum type). State machine định nghĩa ở `09-notification-and-state-flows.md`; mọi chuyển trạng thái phải kiểm tra ở service, và các trạng thái đích hợp lệ được ràng buộc ở DB.

### 4.6 Tương tranh (concurrency)
- Bảng có state machine chịu tranh chấp (`trial_requests`, `class_contracts`, `subscriptions`, `payments`) có cột `version int` cho **optimistic locking**, hoặc dùng `UPDATE ... WHERE status = :expected` và kiểm tra số dòng ảnh hưởng.
- Thao tác tiền/mở quyền chạy trong **transaction**; webhook dùng idempotency key + row lock.

### 4.7 Reliable side-effects: Outbox pattern
- Mọi tác dụng phụ ra ngoài (gửi notification, đồng bộ search, gọi provider) **không gọi trực tiếp trong request**. Ghi `outbox_events` trong cùng transaction nghiệp vụ; worker đọc outbox và thực thi (at-least-once) → không mất sự kiện khi API/queue lỗi.

### 4.8 Idempotency
- API tạo thanh toán/hành động tiền nhận header `Idempotency-Key`; lưu `idempotency_keys` để chống double-submit.
- Webhook chống trùng bằng `provider_reference` + bảng `webhook_events`.

## 5. Sơ đồ triển khai (giai đoạn 1, PA2)

```
[tutor-market PWA] [tutor-app PWA]
        \              /
         \            /
        [ API Gateway / LB ]
                |
         [ tutor-api (NestJS, stateless, scale ngang) ]
          |        |            |             |
     [PostgreSQL] [Redis]  [Object Storage]  [Outbox worker (BullMQ)]
     (primary)   (cache/    (ảnh/video,        |         |
                  ratelimit/ signed URL)  [SMS/Email/Push] [Payment provider]
                  lock)
```

- **Chưa cần** ở giai đoạn 1: Meilisearch, read-replica, sharding — nằm trong bảng ngưỡng mục 2, bật khi chạm.
- Object Storage: S3-compatible (AWS S3 / Cloudflare R2 / Wasabi). Media không lưu trong DB, chỉ lưu URL/khóa.

## 6. Lưu ý triển khai stack

- **Prisma**: dùng migration có kiểm soát; các index đặc thù (GIN, partial, expression, full-text) khai bằng raw SQL trong migration khi Prisma chưa hỗ trợ trực tiếp. Partitioning cũng khai bằng raw SQL.
- **Config/secrets**: mọi bí mật qua biến môi trường/secret manager, không commit. Xem `13-security-and-threat-model.md`.
- **API stateless**: không lưu state phiên trong RAM tiến trình; dùng JWT ngắn hạn + refresh, blacklist/rotate qua Redis.
- **Observability**: log có `request_id`, metric p50/p95/p99 cho search + payment webhook, health check `/healthz` và `/readyz`. Chi tiết ở `12-non-functional-requirements.md`.
