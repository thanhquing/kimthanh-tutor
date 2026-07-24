# Checklist Chuẩn Hóa — Performance & Bảo Mật

File này là **tracker duy nhất** cho các hạng mục performance và bảo mật theo tiêu chuẩn, áp dụng cho `tutor-app`, `tutor-market`, `tutor-admin` và `tutor-api` (BE). Mục tiêu: **mỗi task khi `DONE` phải đảm bảo an toàn và hiệu năng ở những hạng mục nó chạm tới**, tránh nợ kỹ thuật khó refactor về sau.

Đây không phải danh sách bám theo code hiện có mà là bộ hạng mục theo chuẩn:

- **OWASP Top 10 (2021)** — bảo mật ứng dụng web (mục A).
- **OWASP API Security Top 10 (2023)** — bảo mật API/BE (mục B).
- **OWASP ASVS** — mức verification tham chiếu cho A/B.
- **NĐ 13/2023 + `ai-docs/14`** — dữ liệu cá nhân (mục C).
- **Core Web Vitals + performance budget** — hiệu năng FE (mục D).
- **`ai-docs/12` (chịu tải) + `ai-docs/13` (threat model)** — hiệu năng/chịu tải BE (mục E).

## Cách dùng (bắt buộc)

1. Mỗi task `TA-*`/`TM-*`/`AD-*` (gồm cả phần BE refactor trong task) khi hoàn thành phải **cập nhật cột app tương ứng** cho mọi hạng mục mà task chạm tới.
2. Một task **chỉ được `DONE`** khi tất cả hạng mục liên quan tới scope của nó ở cột đó là 🟢 (có evidence: test/cURL/config/migration). Hạng mục không thuộc scope thì giữ nguyên trạng thái cũ, không cần đụng.
3. Không được hạ trạng thái 🟢 của hạng mục do task khác đã đạt (regression guardrail). Nếu phát hiện regression, sửa trong cùng task.
4. Ghi evidence ngắn gọn ở cột "Ghi chú" hoặc trong phần `Nghiệm thu và test` của task (trỏ về mã hạng mục, ví dụ `A01`, `E6`).

## Quy ước trạng thái (3 màu)

| Ký hiệu | Nghĩa |
| --- | --- |
| 🟢 | **Đạt** — đã triển khai và có bằng chứng verify trực tiếp cho hạng mục (test/cURL/config). |
| 🟡 | **Một phần / chưa xác nhận** — có triển khai nhưng chưa đủ độ phủ hoặc chưa audit lại theo hạng mục này. |
| ⚪ | **Chưa làm** — chưa triển khai hoặc chưa dựng màn/endpoint liên quan. Ghi rõ nếu là nợ đã biết. |
| — | **Không áp dụng** cho app đó (ghi lý do nếu không hiển nhiên). |

**Đã rà theo code thật ngày 2026-07-17.** Trạng thái dưới đây phản ánh audit mã nguồn thực tế (`tutor-api/src`, `prisma/schema.prisma`, `tutor-*/src`, config, test) — không suy từ doc. 🟢 = tìm thấy enforce trong code (+ test nơi có ghi); 🟡 = một phần / chưa test / còn gap đã ghi; ⚪ = chưa có hoặc màn/endpoint liên quan chưa dựng. Đây là **audit code, chưa phải pentest / đo tải đầy đủ**. Các task đã `DONE` (`TA-00`/`TA-01`, `TM-00`, `AD-00`) được chứng nhận **theo evidence code** tại đây; hạng mục còn 🟡/⚪ là nợ kỹ thuật đã ghi nhận, không xem là đã đạt.

Cột: **app** = `tutor-app`, **mkt** = `tutor-market`, **adm** = `tutor-admin`, **api** = `tutor-api` (BE).

---

## A. Bảo mật ứng dụng — OWASP Top 10 (2021) + ASVS

| # | Hạng mục | Chuẩn | app | mkt | adm | api | Ghi chú / evidence & gap |
| --- | --- | --- | :-: | :-: | :-: | :-: | --- |
| A01 | Access control fail-closed, ownership/IDOR, capability/RBAC enforce ở server | A01, ASVS V4 | 🟢 | 🟡 | 🟢 | 🟢 | prior evidence giữ nguyên. **TA-06:** list/detail class khóa profile ID + role thật; transition CAS gồm owner và ma trận actor, foreign ID `404`; app chỉ render `capabilities.transitions` (`classes.service.spec.ts`, Flow 6, page tests). **TA-07:** lesson log list/create đi qua owner class, update fail-closed theo `tutorProfileId/deletedAt`; app chỉ hiện sửa theo `capabilities.can_edit` từ server (`classes.service.spec.ts`, `LessonLogsPage.test.tsx`, Flow 6). **TA-08:** payout endpoints yêu cầu tutor role; QR service test chặn payout account của profile khác (`RESOURCE_NOT_FOUND`); UI không giả action chưa có endpoint. |
| A02 | Token/PII không lộ (không localStorage/log/URL); cookie HttpOnly/Secure/SameSite; TLS; no secret client | A02, ASVS V3/V6 | 🟢 | 🟢 | 🟢 | 🟢 | Access token memory-only ở cả 3 FE (không local/session storage); **refresh token trong cookie HttpOnly `SameSite=Strict` `Secure`-prod cho cả 3 app** (app/mkt `kt_refresh` path `/api/v1/auth`, adm `kt_admin_refresh`) — R-05, `auth.controller.spec.ts` (admin + public session cookie); body `login`/`refresh` không lộ `refresh_token` (`verify-api-io.sh`, `verify-flow-01`); api refresh hash sha256 (`auth.service.ts`). Gap: TLS/secret-manager thuộc hạ tầng deploy. |
| A03 | Injection & XSS: query tham số hóa (Prisma), output encoding, no unsafe HTML, CSP | A03, ASVS V5 | 🟢 | 🟢 | 🟢 | 🟢 | api dùng Prisma tham số hóa; raw read-model gồm `SELECT 1` health và **TA-04 `Prisma.sql` + `Prisma.join` parameterized cho latest log bounded**; ValidationPipe global. mkt: JSON-LD escape qua `jsonLdHtml`; app/adm không render HTML ngoài. |
| A04 | Insecure design: threat model `ai-docs/13`, abuse case (spam trial, paywall bypass, guest lead) | A04 | 🟢 | ⚪ | ⚪ | 🟢 | TA-05 evidence giữ nguyên. **TA-06 review:** IDOR, actor escalation, lost update và child-data exposure được model + test; không cho transition trực tiếp `completed` (`ai-docs/13` §TA-06). **TA-07:** edit window là server authority, client không tự đoán; route class-scoped và POST không nhận `class_id` body; `tutor_note` copy rõ là chia sẻ phụ huynh. |
| A05 | Security misconfiguration: security headers (CSP/frame-ancestors/nosniff/referrer-policy), `noindex` private, error envelope không lộ stack/PII | A05, ASVS V14 | 🟢 | 🟢 | 🟢 | 🟢 | app: `noindex` meta (`index.html`) + headers `vite.config.ts` + `DEPLOYMENT.md`; adm: headers + `DEPLOYMENT.md`; mkt: noindex private + `robots.ts`/`sitemap.ts`; api: `helmet()` + CORS localhost-only non-prod, fail-closed prod (`main.ts`, `common/security/cors.ts`). |
| A06 | Vulnerable & outdated components: quy trình `pnpm audit`/cập nhật dependency, không lib EOL | A06 | ⚪ | ⚪ | ⚪ | ⚪ | Chưa có quy trình audit dependency định kỳ. |
| A07 | Auth failures: refresh rotation/single-flight, idle/session timeout, failed-attempt CAS, login/register/forgot rate-limit, logout revoke | A07, ASVS V2 | 🟢 | 🟢 | 🟢 | 🟢 | api: rotation CAS + reuse revoke-all (`auth.service.ts:501-559`), failed-attempt CAS (`:107`), public refresh cookie rotation + 409 CAS grace + clear-on-AUTH_REQUIRED (`auth.controller.spec.ts` public session); app: logout revoke + **phiên sống qua reload nhờ cookie HttpOnly** (`tutor-app/session.e2e.ts`, R-05); mkt: login email+password + phiên reload qua cookie (`tutor-market/auth.e2e.ts` R-05); adm: giữ cookie khi lỗi 5xx (`auth.controller.ts`). |
| A08 | Software/data integrity: webhook verify chữ ký + idempotency + đối chiếu số tiền; side-effect qua outbox; no untrusted deserialization | A08 | — | 🟡 | 🟡 | 🟡 | api: IP allowlist (`billing.service.ts:567`) + dedupe (`webhook_events`) + idempotency; **outbox chỉ ghi trong tx (`outbox.service.ts:21`), chưa có worker dispatch**; chữ ký provider prod còn stub. |
| A09 | Logging & monitoring: `audit_logs` hành động nhạy cảm, `request_id`, redaction (no secret/token/IP/PII raw), **không log dữ liệu trẻ em** | A09, ASVS V7 | 🟢 | 🟡 | 🟡 | 🟢 | request/error redaction giữ nguyên; **TA-06** không console/analytics/snapshot, outbox transition chỉ chứa class ID/from/to; tên học sinh chỉ ở owner response/render (`ClassDetail`). **TA-07:** app không log/snapshot lesson content; create outbox payload chỉ chứa IDs lớp/log/học sinh/phụ huynh, không chứa nội dung/note. **TA-08:** audit payout create chỉ ghi bank code/default; UI/test/E2E không render hoặc log account number thô sau submit. |
| A10 | SSRF: signed upload/URL validate, không fetch URL do user cung cấp ngoài allowlist | A10 | 🟢 | ⚪ | — | 🟡 | app (TA-02): FE chỉ PUT lên signed URL do API cấp và chỉ render URL do server ký (`lib/api/tutors.ts`, `ProfilePage`), không fetch URL người dùng nhập; MIME/size validate client mirror server (`lib/profile/media.ts` + test). api: `media.validate` + `signedReadUrl` (`tutors.service.ts:355,562`); owner-safe `GET /media/:id` fail-closed theo owner (`tutors.service.spec.ts`). Gap còn lại: **`scanStatus` stub `clean`, worker quét virus = INFRA-04**. |

## B. Bảo mật API/BE — OWASP API Security Top 10 (2023)

Cột chính là **api**; cột FE chỉ 🟢 khi FE cũng enforce (không thay server).

| # | Hạng mục | Chuẩn | app | mkt | adm | api | Ghi chú / evidence & gap |
| --- | --- | --- | :-: | :-: | :-: | :-: | --- |
| API1 | BOLA — object-level authorization mọi resource theo id | API1 | — | — | — | 🟢 | prior evidence; **TA-06** `mine/detail/transition` predicate theo member profile, role query không thể tự cấp, foreign class fail-closed (`classes.service.spec.ts`, Flow 6). **TA-07:** lesson logs query by class owner + tutor profile; update by log id requires matching `tutorProfileId`, foreign/deleted log returns 404. **TA-08:** QR create resolves payout account with current tutor profile predicate; foreign account test trả `RESOURCE_NOT_FOUND`. |
| API2 | Broken authentication — JWT ngắn hạn, refresh hash/rotation/revocation | API2 | — | — | — | 🟢 | `refresh_tokens` hash/rotation/revocation ✅. |
| API3 | BOPLA / mass assignment — DTO whitelist, không nhận field thừa (vd `amount`, `class_id`) | API3 | — | — | — | 🟢 | DTO whitelist + test; **TA-06** status/role filter, canonical transition target và expected version ≥0 được validate; `completed` bị từ chối ở transition DTO. **TA-07:** lesson log DTO validate enum/length/date; create lấy class từ path, Playwright assert request body không có `class_id`; DTO validation spec phủ field thừa. **TA-08:** payout DTO normalize/validate strict BIN, digits và holder; catalog reject bank ngoài config. |
| API4 | Unrestricted resource consumption — rate limit, pagination bắt buộc (keyset), payload size/timeout | API4 | — | — | — | 🟡 | TA-05 evidence; **TA-06 class list max 50 + keyset/index, detail join bounded**. **TA-07 lesson log list dùng common limit clamp + keyset `(lesson_at,id)`; form length validate server/client.** Global Redis/payload/timeout vẫn INFRA gap. |
| API5 | Broken function-level authorization — role guard mỗi endpoint admin/nhạy cảm | API5 | — | — | 🟢 | 🟢 | role guard + prior evidence; **TA-06** endpoint cho member nhưng service tách tutor/parent capability; parent không pause/end và không ai transition thủ công `completed`. **TA-07:** lesson log endpoints là tutor flow; service tự resolve tutor profile và không tin role/client capability. **TA-08:** catalog/list/create payout đều `@Roles('tutor')`; service resolve profile từ current user. |
| API6 | Unrestricted access to sensitive business flows — chống spam trial/guest lead, idempotency hành động tiền | API6 | — | 🟡 | — | 🟢 | Idempotency tiền ✅; **TA-05:** `POST /trials` limiter 10/IP/giờ + tối đa 3 lead/phone/giờ bằng query/index DB, trả `RATE_LIMITED` trước khi lưu thêm PII; unit + Flow fixture phone động. Market UI còn TM-05. |
| API7 | SSRF — xem A10 | API7 | — | — | — | 🟡 | Đồng bộ với A10 (scan worker + validate URL chưa đủ). |
| API8 | Security misconfiguration (API) — CORS, header, verbose error | API8 | — | — | — | 🟢 | `helmet()` (`main.ts`); CORS `resolveCorsOrigin` chỉ localhost non-prod, allowlist tường minh + fail-closed prod (`common/security/cors.ts` + `cors.spec.ts`); error envelope đã redact. |
| API9 | Improper inventory management — endpoint catalog `ai-tasks/05` đồng bộ, không endpoint debug ở prod | API9 | — | — | — | 🟡 | Versioning `api/v1` + health exclude; cần đảm bảo không rò debug/dev route ở prod. |
| API10 | Unsafe consumption of 3rd-party APIs — verify webhook provider, đối chiếu số tiền, IP allowlist | API10 | — | — | — | 🟡 | IP allowlist (`billing.service.ts:567`) + dedupe ✅; **chữ ký/API key provider prod còn stub (`signatureVerified` cứng)**. |

## C. Dữ liệu cá nhân & pháp lý — NĐ 13/2023 + `ai-docs/14`

| # | Hạng mục | Chuẩn | app | mkt | adm | api | Ghi chú / evidence & gap |
| --- | --- | --- | :-: | :-: | :-: | :-: | --- |
| C1 | Consent versioning là bước chặn bắt buộc, không bypass bằng UI | NĐ13, `ai-docs/08` | 🟢 | 🟡 | — | 🟢 | api: guard chặn `pending_consent` (`jwt-auth.guard.ts:107`) + `AllowStatus` + consent module; app: consent + scroll gate tested; mkt: TM-03 chưa làm. |
| C2 | Không lưu CCCD (giai đoạn 1) | Guardrail | 🟢 | 🟢 | 🟢 | 🟢 | `schema.prisma` không có trường CCCD/national_id. |
| C3 | Data minimization dữ liệu trẻ em — không vào log/analytics/URL/snapshot | NĐ13, `ai-docs/14` | 🟢 | ⚪ | 🟡 | 🟡 | prior evidence; **TA-06** tên/khối chỉ trả cho thành viên lớp trong detail/list owner-safe, không log/analytics/snapshot; URL chỉ class ID. **TA-07:** sổ đầu bài chỉ mở từ class owner-safe; note được label là chia sẻ phụ huynh, không có “ghi chú riêng”; route chỉ chứa class/log ID. API/adm audit toàn hệ thống còn tiếp tục. |
| C4 | Retention & ẩn danh khi xóa user | NĐ13, `ai-docs/14` | ⚪ | ⚪ | ⚪ | ⚪ | **Không tìm thấy** anonymize/retention/erase trong code — backlog TODO. |
| C5 | Masking PII khi đọc (số tài khoản, phone, identity); không action unmask | NĐ13 | 🟢 | 🟡 | 🟢 | 🟢 | api mask hiện có; **TA-05 scope chặt hơn masking:** presenter luôn `contact=null/can_view_contact=false`, không parse `contact_snapshot`/Lead PII; app giải thích policy và không có action unmask. **TA-08:** payout API chỉ trả `account_number_masked`; form unmount/reset sau submit, audit không chứa raw number, UI/component/Playwright assert chỉ masked value và không có action unmask. |
| C6 | Quyền chủ thể dữ liệu (truy cập/xóa/rút consent) | NĐ13 | ⚪ | ⚪ | ⚪ | ⚪ | Chưa có luồng thực thi quyền chủ thể dữ liệu. |

## D. Performance FE — Core Web Vitals + budget

Áp dụng cho FE; cột **api** = —.

| # | Hạng mục | Chuẩn | app | mkt | adm | api | Ghi chú / mục tiêu |
| --- | --- | --- | :-: | :-: | :-: | :-: | --- |
| D1 | LCP < 2.5s (public route SSR/ISR) | Web Vitals | ⚪ | 🟡 | ⚪ | — | mkt: SSR/ISR có nhưng **chưa đo CWV ở đâu**; app/adm là SPA private. |
| D2 | CLS < 0.1 — skeleton/empty giữ chỗ, không layout shift | Web Vitals | 🟢 | ⚪ | ⚪ | — | **TA-04:** skeleton giữ đúng grid stat/panel, empty/error có min-height; Playwright reload sâu đo PerformanceObserver `layout-shift`, assert CLS < 0.1. |
| D3 | INP < 200ms — tương tác không block | Web Vitals | ⚪ | ⚪ | ⚪ | — | Chưa đo. |
| D4 | TTFB / SSR cache + revalidation | Web Vitals | — | 🟡 | — | — | mkt: cache/revalidation scaffold; chưa đo. |
| D5 | JS bundle budget + code-split theo route + lazy-load màn nặng | Perf budget | 🟢 | 🟡 | ⚪ | — | prior lazy baseline; **TA-06** list/detail là hai lazy chunks (~1.75/~2.60 kB gzip), shared class mapper ~0.75 kB; entry ~254.74 kB gzip ~80.96 kB. **TA-07:** `LessonLogsPage` lazy chunk 4.39 kB gzip; entry 81.11 kB gzip. **TA-08:** `PayoutAccountsPage` lazy chunk; production Vite build pass. |
| D6 | Ảnh tối ưu (kích thước/định dạng, lazy-load), **không N+1 signed URL** | Perf budget | 🟢 | ⚪ | ⚪ | — | app (TA-02): avatar/video fetch signed URL **bounded (đúng 2 lời gọi, không AGG/N+1)**, `<img object-fit:cover>` (`ProfilePage`/`global.css`); mkt/adm màn media chưa dựng. |
| D7 | Fetch: query song song + failure isolation, abort request cũ, `staleTime`/dedupe | Perf budget | 🟢 | 🟡 | 🟡 | — | App Query/Abort; **TA-06** detail/list key theo tutor/class, conflict payload thay state ngay và không refetch stale khi payload hợp lệ; component race test. **TA-07:** class detail và lesson log queries keyed by class; create/update patch cache ngay, invalidate dashboard, update error refetches server capability. **TA-08:** bank catalog và masked account list query song song, mutation patch cache rồi invalidate list. |
| D8 | Keyset pagination FE (no offset, no fake total) | `ai-docs/12` | 🟢 | 🟡 | ⚪ | — | TA-05 + **TA-06 class list `useInfiniteQuery` theo `next_cursor`, không fake total/offset**. **TA-07:** lesson logs dùng `useInfiniteQuery` theo `next_cursor`, merge dedupe theo id, không fake total. |

## E. Performance & chịu tải BE — `ai-docs/12`

Cột chính là **api**.

| # | Hạng mục | Chuẩn | app | mkt | adm | api | Ghi chú / evidence & gap |
| --- | --- | --- | :-: | :-: | :-: | :-: | --- |
| E1 | Không N+1 (batch/join hoặc aggregate owner-safe) | `ai-docs/12` | — | — | — | 🟢 | TA-04 evidence; **TA-06** list/detail lấy parent/student/trial summary bằng một Prisma include bounded, không query theo item. **TA-07:** lesson log list là một bounded `findMany` theo class+tutor; dashboard read Flow 7 vẫn đọc timeline bounded. |
| E2 | Index hot-path filter/search + benchmark `EXPLAIN ANALYZE` trong CI | `ai-docs/12` | — | — | — | 🟡 | TA-05 + **TA-06 owner/status/updated/id composite index**. Benchmark CI toàn hệ thống vẫn thiếu. |
| E3 | Keyset pagination server (no offset) | `ai-docs/12` | — | — | — | 🟢 | common keyset + **TA-05 trials và TA-06 classes `(updated_at,id)`, max 50**. **TA-07:** lesson logs keyset theo `(lesson_at,id)` + `limit + 1`, invalid cursor trả validation error. |
| E4 | Đọc cột denormalized đã index (rating…), không AGG runtime | `ai-docs/12` | — | — | — | 🟢 | `rating_avg`/`rating_count` denormalized (`schema.prisma:355`). |
| E5 | Optimistic lock / expected-state CAS cho state machine | `ai-docs/15` §4 | — | — | — | 🟢 | TA-05 evidence; **TA-06** class transition `updateMany WHERE owner,status,version`, conflict trả current class; unit/component/Flow stale transition. |
| E6 | Idempotency-Key + webhook dedupe | `ai-docs/15` §4 | — | — | — | 🟢 | `idempotency_keys` + `webhook_events`. |
| E7 | Side-effect qua outbox worker (không gọi provider trong request) | `ai-docs/15` §4 | — | — | — | 🟡 | TA-05 + **TA-06 transition emit `class.transitioned` trong cùng transaction**, không gọi provider. **TA-07:** `lesson_log.created` emit trong cùng transaction, payload chỉ IDs; update không gọi provider. Worker dispatch vẫn INFRA backlog. |
| E8 | Rate limit + giới hạn connection/timeout | `ai-docs/12` | — | — | — | 🟡 | TA-05 có limiter IP riêng + phone DB-backed; global `ThrottlerGuard` vẫn in-memory và connection/timeout policy thuộc INFRA. |

---

## Nợ kỹ thuật đã biết (ưu tiên đưa về 🟢)

Các gap phát hiện khi rà code 2026-07-17, xếp theo mức ưu tiên:

**Đã xử lý 2026-07-17 (hardening task cũ):**

- ✅ **A03 (mkt)** JSON-LD escape qua `jsonLdHtml` + test — `lib/metadata.ts`, `metadata.test.ts`.
- ✅ **A05/API8 (api)** thêm `helmet()` + `resolveCorsOrigin` (localhost non-prod, fail-closed prod) + `cors.spec.ts`.
- ✅ **A05 (app)** thêm `noindex` meta + security headers (`vite.config.ts`) + `DEPLOYMENT.md`.

**Hạ tầng/xuyên suốt — đã gom thành nhóm task cuối backlog** (`01-backlog.md` §Nhóm việc 10, cần explicit approval; không nhét vào task feature):

| Task | Hạng mục kéo lên 🟢 khi hoàn tất |
| --- | --- |
| INFRA-01 Redis foundation | tiền đề cho E7/E8 |
| INFRA-02 Outbox worker (BullMQ) | E7, A08 |
| INFRA-03 Distributed rate-limit + request hardening | E8, API4 |
| INFRA-04 Media pipeline (object storage + virus scan) | A10, API7 |
| INFRA-05 Payment provider production (chữ ký/IP/refund) | API10, A08 |
| INFRA-06 Data retention & quyền chủ thể dữ liệu (NĐ13) | C4, C6 |
| INFRA-07 Perf benchmark & observability (EXPLAIN CI, p95) | E2, E1 |
| INFRA-08 Security process (dependency audit, threat-model) | A06, A04 |

Khi nhận một INFRA task, hoàn tất scope rồi cập nhật cột `api` (hoặc app liên quan) các hạng mục trên sang 🟢 cùng commit. Các hạng mục D-series và C3/C5 phía FE sẽ tự đạt qua cổng `DONE` của chính task feature dựng màn tương ứng.
