# CLAUDE.md — Kim Thanh Tutor

Hướng dẫn cho AI/dev khi làm việc trong monorepo này. File này là **điểm vào duy nhất**: nó không lặp lại nội dung `ai-docs`/`ai-tasks` mà chỉ đồng bộ và trỏ tới đúng nguồn. Khi có mâu thuẫn, thứ tự ưu tiên: **code đang chạy → `ai-docs` → `ai-tasks` → file này**. Nếu code khác doc, sửa cho khớp và cập nhật doc (xem [§9](#9-đồng-bộ-tài-liệu-bắt-buộc)).

Ngôn ngữ tài liệu và comment: **tiếng Việt**. Định danh code (biến, hàm, class, bảng, enum): **tiếng Anh** theo snake_case cho DB và camelCase cho TS.

---

## 1. Quy tắc vàng (đọc trước khi code)

1. **Đọc doc liên quan trước.** Task kỹ thuật luôn đọc thêm `ai-docs/15` (quy ước chung), `ai-docs/12` (chịu tải), `ai-docs/13` (bảo mật), `ai-docs/14` (pháp lý dữ liệu). Chi tiết quy trình: `ai-tasks/03-ai-working-rules.md`.
   Với frontend, đọc `ai-tasks/14-active-work.md` trước để nhận đúng `Current task`; không tự chọn task `TODO` khác.
2. **Kiểm tra `ai-tasks/04-open-questions.md`** để biết assumption nào chưa chốt trước khi tự quyết.
3. **Không thêm scope ngoài MVP** nếu không có yêu cầu. Phạm vi: `ai-docs/03-product-scope.md`.
4. **Task chạm tiền / pháp lý / quyền riêng tư / phân quyền** → bắt buộc: validation phía server + ownership check (fail closed) + audit log.
5. **Cập nhật doc** khi phần triển khai làm thay đổi business rule.

---

## 2. Cấu trúc monorepo

pnpm workspace (`pnpm-workspace.yaml`), Node ≥ 18.12 (dùng 20, xem `.nvmrc`), packageManager `pnpm@9.12.3`.

| Thư mục | Vai trò | Stack | Trạng thái |
| --- | --- | --- | --- |
| `tutor-api` | Backend: nghiệp vụ, auth, thanh toán, mở khóa, lớp, sổ đầu bài, thông báo | NestJS 10 + PostgreSQL 15+ + Prisma | Đã có module đầy đủ; flow cURL 1-12 Verified 2026-07-14; 93 unit tests pass 2026-07-16 |
| `tutor-market` | App **phụ huynh**: chợ gia sư + bảng điều khiển học tập | Next.js App Router, SSR/ISR + private client shell | `TM-00` DONE; business UI theo `TM-01`–`TM-13` |
| `tutor-app` | App **gia sư**: hồ sơ, lịch dạy, dạy thử, sổ đầu bài, QR | Vite + React SPA | `TA-00` DONE; current task `TA-01` |
| `tutor-admin` | App quản trị nội bộ (role `admin`) | Vite + React SPA | `AD-00` DONE: auth/RBAC, shell và API client; nghiệp vụ theo `AD-01`–`AD-09` |
| `tutor-e2e` | E2E smoke browser thật (Playwright) dùng chung cho 3 app; multi-project + seed dùng chung (`@kimthanh-tutor/e2e`) | Playwright + Chrome hệ thống | Harness + smoke TA-02/TA-03, AD-00, TM-00 |
| `packages/contracts` | DTO/type/enum dùng chung API ↔ apps (`@kimthanh-tutor/contracts`) | TypeScript thuần | Có type nền tảng |
| `ai-docs` | Tài liệu tham chiếu sản phẩm/nghiệp vụ/kỹ thuật | — | Nguồn chân lý nghiệp vụ |
| `ai-tasks` | Backlog, mốc, quy tắc, catalog endpoint, verify | — | Nguồn chân lý triển khai |

Quy ước tên: "ứng dụng phụ huynh" = `tutor-market`; "ứng dụng gia sư" = `tutor-app`.

---

## 3. Lệnh thường dùng

Từ **root**:

```bash
pnpm install
pnpm build            # build tất cả package có script build
pnpm test             # test tất cả
pnpm lint             # lint tất cả
pnpm dev:api          # tutor-api start:dev
pnpm dev:market       # tutor-market dev
pnpm dev:app          # tutor-app dev
pnpm dev:admin        # tutor-admin dev

# E2E smoke browser thật (cần API dockerized: docker compose up -d db api; Node ≥ 20)
pnpm --filter @kimthanh-tutor/e2e test         # cả 3 app; hoặc test:app | test:admin | test:market
```

`tutor-api` (chạy trong thư mục con hoặc `pnpm --filter tutor-api <script>`):

```bash
cp .env.example .env          # sửa DATABASE_URL, secrets, VietQR/SePay
pnpm prisma:generate          # sinh Prisma client
npx prisma db push            # tạo bảng local khi chưa có migrations
pnpm start:dev                # http://localhost:3000/api/v1
pnpm test                     # jest (unit: *.spec.ts)
pnpm lint                     # eslint --fix
```

Health: `GET /healthz`, `GET /readyz` (readyz kiểm tra DB).

**Verify E2E bằng Docker Compose** (từ root): dựng PostgreSQL + API, `prisma db push`, rồi chạy `tutor-api/scripts/verify-api-io.sh` + các script `verify-flow-*.sh`:

```bash
docker compose up --build --abort-on-container-exit verify
```

---

## 4. Quy ước code BẮT BUỘC (nguồn: `ai-docs/15` §4)

Đây là phần "làm đúng ngay từ đầu" quyết định khả năng chịu tải và bảo trì. Áp dụng cho **mọi bảng và API**.

- **ID** = ULID (hoặc UUIDv7), lưu `char(26)`/`uuid`. KHÔNG dùng UUIDv4 ngẫu nhiên (dùng util ULID sẵn có trong `tutor-api/src/common/utils`).
- **Thời gian** = UTC `timestamptz`. Mọi bảng có `created_at`; bảng sửa được có `updated_at`. Quy đổi `Asia/Ho_Chi_Minh` chỉ ở tầng hiển thị.
- **Tiền** = số nguyên VND (`bigint`, đơn vị đồng). KHÔNG dùng float. Luôn kèm `currency` (mặc định `VND`).
- **Xóa mềm**: dữ liệu nghiệp vụ dùng `deleted_at`. Dữ liệu tài chính (`payments`, `refunds`, `audit_logs`, `legal_consents`, `outbox_events`) là **append-only** — đổi trạng thái bằng bản ghi mới, không ghi đè lịch sử.
- **Enum** lưu `text` có CHECK constraint (hoặc Postgres enum). Mọi chuyển trạng thái kiểm tra ở service + ràng buộc ở DB. State machine: `ai-docs/09`.
- **Tương tranh**: bảng có state machine chịu tranh chấp (`trial_requests`, `class_contracts`, `subscriptions`, `payments`) dùng optimistic lock (cột `version`) hoặc `UPDATE ... WHERE status = :expected` + kiểm số dòng.
- **Side-effect** (notification, đồng bộ search, gọi provider) đi qua **outbox** (`outbox_events` trong cùng transaction), KHÔNG gọi trực tiếp trong request.
- **Idempotency**: API tạo thanh toán/hành động tiền nhận header `Idempotency-Key` (bảng `idempotency_keys`). Webhook chống trùng bằng `provider_reference` + `webhook_events`.
- **Webhook**: verify chữ ký + đối chiếu số tiền + chống trùng + IP allowlist.
- **Danh sách lớn**: keyset pagination, KHÔNG dùng offset (helper trong `tutor-api/src/common/pagination`).
- **Search**: đọc cột denormalized đã index, không AGG runtime. Controller phụ thuộc `SearchPort` (`tutor-api/src/modules/search/search.port.ts`); adapter Postgres (lọc bảng chuẩn hóa) là mặc định, đổi engine = đổi `useClass` trong `search.module.ts`.

Enum/type dùng chung phải khai trong `packages/contracts` để API và apps không lệch hợp đồng — không định nghĩa trùng ở từng project.

---

## 5. Kiến trúc `tutor-api`

Chia module theo **bounded context** (miền nghiệp vụ), không theo tầng kỹ thuật. Mỗi module **sở hữu bảng của mình**; module khác truy cập qua service, KHÔNG query chéo bảng.

- Layout mỗi module: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.service.spec.ts`, `dto/`.
- Cross-cutting ở `src/common` (auth/guard, errors, filters, middleware request-id, pagination, payments, shared, utils) và `src/prisma`.
- API stateless giữa các request: JWT access ngắn hạn; refresh token hash/rotation/revocation hiện lưu trong PostgreSQL (`refresh_tokens`). Redis chưa là dependency runtime và chỉ được bật sau cho cache, distributed rate limit/lock và BullMQ.
- Index đặc thù (GIN, partial, expression, FTS) và partitioning khai bằng raw SQL trong Prisma migration.

Danh sách module & ranh giới đầy đủ: `ai-docs/15` §3. Catalog endpoint (I/O, quyền, thứ tự): `ai-tasks/05-api-endpoints.md`.

---

## 6. Guardrail sản phẩm (không được vi phạm)

- **Auth người dùng**: Google/Facebook OAuth là đường đăng ký/đăng nhập **chính**. OTP SĐT chỉ là fallback/local, mã cố định `272727` ở non-production cho tới khi có provider OTP thật. `tutor-admin` dùng credential email/password riêng đã provision ngoài UI; không mở đăng ký password cho parent/tutor.
- **Không thu hộ học phí**: hệ thống chỉ tạo QR/link theo thông tin gia sư nhập và ghi trạng thái "gia sư đã đánh dấu đã thu". QR phải nhắc rõ hệ thống **không** xác nhận tiền vào ngân hàng.
- **Không lưu CCCD** trong giai đoạn 1.
- **Consent pháp lý** là bước chặn bắt buộc, không bỏ qua bằng giao diện; có versioning cho điều khoản/chính sách/consent.
- **Paywall** minh bạch: nói rõ nội dung bị khóa và giá trị mở khóa. Khách chưa đăng nhập vẫn tìm gia sư được ngay.
- **Bảng điều khiển học tập** chỉ mở khi có lớp + gói theo dõi hợp lệ.
- **Đánh giá**: chỉ phụ huynh có lớp đã kết thúc mới được đánh giá; có kiểm duyệt/tố cáo.
- 4 sản phẩm thu phí: `single_unlock`, `parent_vip`, `parent_tracking`, `tutor_qr`.
- Doanh thu: VietQR/NAPAS 247 (miễn phí). Học phí → QR vào TK gia sư (tự đối chiếu). Doanh thu nền tảng → VietQR vào TK nền tảng + webhook (SePay/Casso) auto-unlock.

---

## 7. Definition of Done cho một feature

- Có validation phía server.
- Có trạng thái lỗi/thành công rõ ràng.
- Có phân quyền theo vai trò (`guest`/`parent`/`tutor`/`admin`/`system`).
- Có test hoặc checklist verify.
- **Với feature frontend (màn có gọi API): bắt buộc có E2E smoke trên browser thật** (Playwright headless, API dockerized) chạy happy-path màn đó — không chỉ unit/component test với `fetch` mock. Ranh giới tích hợp dùng chung (`ApiClient`, auth/token store) phải có test chạy implementation thật. Chi tiết: `ai-tasks/09` §4–§5 và `ai-tasks/06` §"Frontend E2E smoke".
- Có cập nhật docs nếu business rule thay đổi.
- Nếu feature dùng trong mock UI/UX: flow tương ứng trong `ai-tasks/07-api-curl-user-flows.md` phải chạy end-to-end hoặc ghi rõ blocker. Test fail → refactor/improve API cho đạt business flow rồi cập nhật MD.
- Đưa mọi hạng mục performance/bảo mật (OWASP Top 10/ASVS, OWASP API Security Top 10, Core Web Vitals, NĐ 13/2023, `ai-docs/12`–`14`) mà task chạm tới sang 🟢 kèm evidence trong `ai-tasks/15-perf-security-checklist.md`; còn hạng mục liên quan ở 🟡/⚪ thì chưa `DONE`. Mục tiêu: mỗi task hoàn thành không để lại nợ kỹ thuật security/performance.

---

## 8. Bản đồ tài liệu

**`ai-docs/`** (nghiệp vụ & kỹ thuật nền — đọc theo `ai-docs/00-index.md`):
`01` business flow · `02` improvements · `03` product scope · `04` roles & permissions · `05` domain model · `06` API contract · `07` payments & monetization · `08` legal/consent/privacy · `09` notification & state machine · `10` acceptance criteria · `11` database ERD · `12` NFR/chịu tải · `13` security & threat model · `14` data privacy (NĐ 13/2023) · **`15` architecture & tech stack (tài liệu sống còn — mọi doc khác tham chiếu)**.

**`ai-tasks/`** (triển khai — đọc theo `ai-tasks/00-index.md`):
`01` backlog · `02` milestones · `03` AI working rules · `04` open questions · `05` API endpoints catalog · `06` verification checklist · `07` cURL user flows · `08` mock prompts · `09` frontend governance · `10` tutor-app tasks · `11` tutor-market tasks · `12` tutor-admin tasks · `13` mock audit · **`14` active work/current task** · `15` checklist chuẩn hóa performance & bảo mật (cổng `DONE`).

---

## 9. Đồng bộ tài liệu (bắt buộc)

Repo này lấy tài liệu làm nguồn chân lý, nên khi code và doc lệch nhau phải kéo lại cho khớp — đây là lý do file `CLAUDE.md` tồn tại:

1. Đổi **business rule / API contract / schema** → cập nhật đúng file trong `ai-docs` (và `packages/contracts` nếu là type dùng chung) trong cùng change.
2. Đổi **cách verify / thêm flow / thêm endpoint** → cập nhật `ai-tasks/05`, `ai-tasks/06`, `ai-tasks/07` và script `verify-flow-*.sh` liên quan.
3. Đổi **stack / quy ước chung / ranh giới module** → cập nhật `ai-docs/15` **trước khi** code.
4. Đổi cấu trúc thư mục / lệnh / guardrail lớn → cập nhật `CLAUDE.md` này.
5. Khi đánh dấu một flow là `Verified`, ghi kèm ngày và bằng chứng (script cURL chạy được).
