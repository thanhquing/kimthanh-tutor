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
| A01 | Access control fail-closed, ownership/IDOR, capability/RBAC enforce ở server | A01, ASVS V4 | 🟢 | 🟡 | 🟢 | 🟢 | api: role guard `jwt-auth.guard.ts:120` + ownership tests (parents/trials/qr); **TA-02: `GET /media/:id` fail-closed theo owner + suspended profile khóa edit**; app: `decideRouteAccess` + App/AppShell tests + `ProfilePage` bootstrap/suspended gate; adm: non-admin 403 tested; mkt: `(private)/layout.tsx` guard, màn business chưa dựng. |
| A02 | Token/PII không lộ (không localStorage/log/URL); cookie HttpOnly/Secure/SameSite; TLS; no secret client | A02, ASVS V3/V6 | 🟢 | 🟢 | 🟢 | 🟢 | Không có token trong localStorage/sessionStorage ở cả 3 FE (memory-only); adm refresh cookie HttpOnly SameSite=Strict (`auth.controller.spec.ts:62`); api refresh hash sha256 (`auth.service.ts:591`). Gap: TLS/secret-manager thuộc hạ tầng deploy. |
| A03 | Injection & XSS: query tham số hóa (Prisma), output encoding, no unsafe HTML, CSP | A03, ASVS V5 | 🟢 | 🟢 | 🟢 | 🟢 | api: chỉ Prisma tham số hóa, raw duy nhất `SELECT 1` (`health.controller.ts:19`) + ValidationPipe; mkt: JSON-LD escape qua `jsonLdHtml` (`lib/metadata.ts`) + test `metadata.test.ts` (chuỗi `</script>` bị escape); app/adm không render HTML ngoài. |
| A04 | Insecure design: threat model `ai-docs/13`, abuse case (spam trial, paywall bypass, guest lead) | A04 | ⚪ | ⚪ | ⚪ | 🟡 | Có throttler + idempotency nhưng **chưa có threat-model review chính thức per feature**. |
| A05 | Security misconfiguration: security headers (CSP/frame-ancestors/nosniff/referrer-policy), `noindex` private, error envelope không lộ stack/PII | A05, ASVS V14 | 🟢 | 🟢 | 🟢 | 🟢 | app: `noindex` meta (`index.html`) + headers `vite.config.ts` + `DEPLOYMENT.md`; adm: headers + `DEPLOYMENT.md`; mkt: noindex private + `robots.ts`/`sitemap.ts`; api: `helmet()` + CORS localhost-only non-prod, fail-closed prod (`main.ts`, `common/security/cors.ts`). |
| A06 | Vulnerable & outdated components: quy trình `pnpm audit`/cập nhật dependency, không lib EOL | A06 | ⚪ | ⚪ | ⚪ | ⚪ | Chưa có quy trình audit dependency định kỳ. |
| A07 | Auth failures: refresh rotation/single-flight, idle/session timeout, failed-attempt CAS, OTP cooldown/rate-limit, logout revoke | A07, ASVS V2 | 🟢 | 🟡 | 🟢 | 🟢 | api: rotation CAS + reuse revoke-all (`auth.service.ts:501-559`), failed-attempt CAS (`:107`), OTP lockout (`:174`); app: logout revoke tested; adm: giữ cookie khi lỗi 5xx (`auth.controller.ts:119`); mkt: auth TM-03 chưa dựng. |
| A08 | Software/data integrity: webhook verify chữ ký + idempotency + đối chiếu số tiền; side-effect qua outbox; no untrusted deserialization | A08 | — | 🟡 | 🟡 | 🟡 | api: IP allowlist (`billing.service.ts:567`) + dedupe (`webhook_events`) + idempotency; **outbox chỉ ghi trong tx (`outbox.service.ts:21`), chưa có worker dispatch**; chữ ký provider prod còn stub. |
| A09 | Logging & monitoring: `audit_logs` hành động nhạy cảm, `request_id`, redaction (no secret/token/IP/PII raw), **không log dữ liệu trẻ em** | A09, ASVS V7 | 🟡 | 🟡 | 🟡 | 🟢 | api: `audit.service.ts` + `request-id.middleware.ts` + redact ở `all-exceptions.filter.ts`; FE: chưa thấy log PII nhưng chưa audit snapshot từng màn. |
| A10 | SSRF: signed upload/URL validate, không fetch URL do user cung cấp ngoài allowlist | A10 | 🟢 | ⚪ | — | 🟡 | app (TA-02): FE chỉ PUT lên signed URL do API cấp và chỉ render URL do server ký (`lib/api/tutors.ts`, `ProfilePage`), không fetch URL người dùng nhập; MIME/size validate client mirror server (`lib/profile/media.ts` + test). api: `media.validate` + `signedReadUrl` (`tutors.service.ts:355,562`); owner-safe `GET /media/:id` fail-closed theo owner (`tutors.service.spec.ts`). Gap còn lại: **`scanStatus` stub `clean`, worker quét virus = INFRA-04**. |

## B. Bảo mật API/BE — OWASP API Security Top 10 (2023)

Cột chính là **api**; cột FE chỉ 🟢 khi FE cũng enforce (không thay server).

| # | Hạng mục | Chuẩn | app | mkt | adm | api | Ghi chú / evidence & gap |
| --- | --- | --- | :-: | :-: | :-: | :-: | --- |
| API1 | BOLA — object-level authorization mọi resource theo id | API1 | — | — | — | 🟢 | Ownership check + test flow ✅; TA-02: `getMediaStatus` lọc `ownerUserId` + test fail-closed (`tutors.service.spec.ts`); giữ fail-closed cho endpoint mới. |
| API2 | Broken authentication — JWT ngắn hạn, refresh hash/rotation/revocation | API2 | — | — | — | 🟢 | `refresh_tokens` hash/rotation/revocation ✅. |
| API3 | BOPLA / mass assignment — DTO whitelist, không nhận field thừa (vd `amount`, `class_id`) | API3 | — | — | — | 🟢 | `ValidationPipe` `whitelist: true, forbidNonWhitelisted: true` (`main.ts:23-24`) + `dto-validation.spec.ts`. |
| API4 | Unrestricted resource consumption — rate limit, pagination bắt buộc (keyset), payload size/timeout | API4 | — | — | — | 🟡 | `ThrottlerGuard` global (`app.module.ts:38,67`) **in-memory** + keyset; distributed (Redis) + payload/timeout policy TODO. |
| API5 | Broken function-level authorization — role guard mỗi endpoint admin/nhạy cảm | API5 | — | — | 🟢 | 🟢 | Role guard `jwt-auth.guard.ts:120` + admin tests. |
| API6 | Unrestricted access to sensitive business flows — chống spam trial/guest lead, idempotency hành động tiền | API6 | — | 🟡 | — | 🟡 | Idempotency tiền ✅ (chỉ throttler chung); chống lạm dụng guest/trial chuyên biệt cần bổ sung. |
| API7 | SSRF — xem A10 | API7 | — | — | — | 🟡 | Đồng bộ với A10 (scan worker + validate URL chưa đủ). |
| API8 | Security misconfiguration (API) — CORS, header, verbose error | API8 | — | — | — | 🟢 | `helmet()` (`main.ts`); CORS `resolveCorsOrigin` chỉ localhost non-prod, allowlist tường minh + fail-closed prod (`common/security/cors.ts` + `cors.spec.ts`); error envelope đã redact. |
| API9 | Improper inventory management — endpoint catalog `ai-tasks/05` đồng bộ, không endpoint debug ở prod | API9 | — | — | — | 🟡 | Versioning `api/v1` + health exclude; cần đảm bảo không rò debug/dev route ở prod. |
| API10 | Unsafe consumption of 3rd-party APIs — verify webhook provider, đối chiếu số tiền, IP allowlist | API10 | — | — | — | 🟡 | IP allowlist (`billing.service.ts:567`) + dedupe ✅; **chữ ký/API key provider prod còn stub (`signatureVerified` cứng)**. |

## C. Dữ liệu cá nhân & pháp lý — NĐ 13/2023 + `ai-docs/14`

| # | Hạng mục | Chuẩn | app | mkt | adm | api | Ghi chú / evidence & gap |
| --- | --- | --- | :-: | :-: | :-: | :-: | --- |
| C1 | Consent versioning là bước chặn bắt buộc, không bypass bằng UI | NĐ13, `ai-docs/08` | 🟢 | 🟡 | — | 🟢 | api: guard chặn `pending_consent` (`jwt-auth.guard.ts:107`) + `AllowStatus` + consent module; app: consent + scroll gate tested; mkt: TM-03 chưa làm. |
| C2 | Không lưu CCCD (giai đoạn 1) | Guardrail | 🟢 | 🟢 | 🟢 | 🟢 | `schema.prisma` không có trường CCCD/national_id. |
| C3 | Data minimization dữ liệu trẻ em — không vào log/analytics/URL/snapshot | NĐ13, `ai-docs/14` | 🟡 | ⚪ | 🟡 | 🟡 | mkt: student CRUD chưa dựng; cần rule redaction xuyên suốt khi dựng màn. |
| C4 | Retention & ẩn danh khi xóa user | NĐ13, `ai-docs/14` | ⚪ | ⚪ | ⚪ | ⚪ | **Không tìm thấy** anonymize/retention/erase trong code — backlog TODO. |
| C5 | Masking PII khi đọc (số tài khoản, phone, identity); không action unmask | NĐ13 | 🟡 | 🟡 | 🟢 | 🟢 | api: mask ở server (`admin.service.ts:1092-1107`, `tutors.service.ts:565`); adm hiển thị masked; màn payout/account app/mkt chưa dựng. |
| C6 | Quyền chủ thể dữ liệu (truy cập/xóa/rút consent) | NĐ13 | ⚪ | ⚪ | ⚪ | ⚪ | Chưa có luồng thực thi quyền chủ thể dữ liệu. |

## D. Performance FE — Core Web Vitals + budget

Áp dụng cho FE; cột **api** = —.

| # | Hạng mục | Chuẩn | app | mkt | adm | api | Ghi chú / mục tiêu |
| --- | --- | --- | :-: | :-: | :-: | :-: | --- |
| D1 | LCP < 2.5s (public route SSR/ISR) | Web Vitals | ⚪ | 🟡 | ⚪ | — | mkt: SSR/ISR có nhưng **chưa đo CWV ở đâu**; app/adm là SPA private. |
| D2 | CLS < 0.1 — skeleton/empty giữ chỗ, không layout shift | Web Vitals | ⚪ | ⚪ | ⚪ | — | Chưa đo; đo khi dựng màn business. |
| D3 | INP < 200ms — tương tác không block | Web Vitals | ⚪ | ⚪ | ⚪ | — | Chưa đo. |
| D4 | TTFB / SSR cache + revalidation | Web Vitals | — | 🟡 | — | — | mkt: cache/revalidation scaffold; chưa đo. |
| D5 | JS bundle budget + code-split theo route + lazy-load màn nặng | Perf budget | ⚪ | 🟡 | ⚪ | — | **Không có `React.lazy`/route split ở app/adm**; Next tự split route cho mkt; chưa đặt bundle budget. |
| D6 | Ảnh tối ưu (kích thước/định dạng, lazy-load), **không N+1 signed URL** | Perf budget | 🟢 | ⚪ | ⚪ | — | app (TA-02): avatar/video fetch signed URL **bounded (đúng 2 lời gọi, không AGG/N+1)**, `<img object-fit:cover>` (`ProfilePage`/`global.css`); mkt/adm màn media chưa dựng. |
| D7 | Fetch: query song song + failure isolation, abort request cũ, `staleTime`/dedupe | Perf budget | 🟢 | 🟡 | 🟡 | — | app: `@tanstack/react-query` + `AbortController` (`lib/api/client.ts`); mkt: client có abort; adm: chưa thấy react-query. |
| D8 | Keyset pagination FE (no offset, no fake total) | `ai-docs/12` | 🟡 | 🟡 | ⚪ | — | app/mkt: client hỗ trợ cursor; áp dụng khi dựng list; adm list chưa dựng. |

## E. Performance & chịu tải BE — `ai-docs/12`

Cột chính là **api**.

| # | Hạng mục | Chuẩn | app | mkt | adm | api | Ghi chú / evidence & gap |
| --- | --- | --- | :-: | :-: | :-: | :-: | --- |
| E1 | Không N+1 (batch/join hoặc aggregate owner-safe) | `ai-docs/12` | — | — | — | 🟡 | Chủ yếu dùng `include/select`; cần audit từng endpoint list/detail mới. |
| E2 | Index hot-path filter/search + benchmark `EXPLAIN ANALYZE` trong CI | `ai-docs/12` | — | — | — | 🟡 | Index chuẩn hóa search có trong schema/migration; **benchmark `EXPLAIN ANALYZE` trong CI chưa có**. |
| E3 | Keyset pagination server (no offset) | `ai-docs/12` | — | — | — | 🟢 | `common/pagination/keyset.ts` + search/timeline. |
| E4 | Đọc cột denormalized đã index (rating…), không AGG runtime | `ai-docs/12` | — | — | — | 🟢 | `rating_avg`/`rating_count` denormalized (`schema.prisma:355`). |
| E5 | Optimistic lock / expected-state CAS cho state machine | `ai-docs/15` §4 | — | — | — | 🟢 | `updateMany ... where status/revokedAt` CAS (`auth.service.ts:501-559`), trial/class/subscription/payment. |
| E6 | Idempotency-Key + webhook dedupe | `ai-docs/15` §4 | — | — | — | 🟢 | `idempotency_keys` + `webhook_events`. |
| E7 | Side-effect qua outbox worker (không gọi provider trong request) | `ai-docs/15` §4 | — | — | — | 🟡 | Ghi `outbox_events` trong tx (`outbox.service.ts:21`) nhưng **chưa có worker dispatch** (notification tạo trực tiếp trong tx). |
| E8 | Rate limit + giới hạn connection/timeout | `ai-docs/12` | — | — | — | 🟡 | `ThrottlerGuard` **in-memory** (Redis chưa là runtime dep); timeout policy TODO. |

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
