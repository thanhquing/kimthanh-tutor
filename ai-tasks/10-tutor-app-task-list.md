# Task List — `tutor-app` (Gia Sư)

Tất cả task khởi tạo ở trạng thái `TODO`. Quy tắc trạng thái, commit và Definition of Done: `09-frontend-task-governance.md`. Sai lệch mock cần xử lý: `13-mock-ui-ux-audit.md`.

Snapshot 2026-07-17: `TA-00` và `TA-01` DONE theo evidence bên dưới; `TA-02` là `Current task`. Placeholder route của TA-03–TA-13 không phải feature đã hoàn tất.

## Thứ tự đề xuất

| Thứ tự | Task | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- |
| 1 | TA-00 Scaffold, contracts, shell và API client | — | DONE |
| 2 | TA-01 Auth, role và legal consent | TA-00 | DONE |
| 3 | TA-02 Hồ sơ, media và publish | TA-01 | TODO |
| 4 | TA-03 Lịch available/busy | TA-01 | TODO |
| 5 | TA-04 Dashboard công việc | TA-02, TA-03 | TODO |
| 6 | TA-05 Inbox yêu cầu học thử | TA-01 | TODO |
| 7 | TA-06 Lớp và state machine | TA-05 | TODO |
| 8 | TA-07 Sổ đầu bài | TA-06 | TODO |
| 9 | TA-08 Tài khoản nhận học phí | TA-01 | TODO |
| 10 | TA-09 Checkout/gói `tutor_qr` | TA-01 | TODO |
| 11 | TA-10 QR học phí | TA-06, TA-08, TA-09 | TODO |
| 12 | TA-11 Xem và report review | TA-06 | TODO |
| 13 | TA-12 Thông báo | TA-01 | TODO |
| 14 | TA-13 PWA, accessibility và E2E xuyên app | TA-02–TA-12 | TODO |

---

## Checklist bắt buộc — Performance & Bảo mật (áp dụng mọi task)

Danh mục hạng mục chuẩn (OWASP Top 10/ASVS, OWASP API Security Top 10, Core Web Vitals, NĐ 13/2023, `ai-docs/12`–`14`) và trạng thái 3 màu được theo dõi tập trung tại **`15-perf-security-checklist.md`** (cột `app` = `tutor-app`). Task list này không lặp lại danh sách để tránh lệch nguồn.

**Cổng `DONE` (từ `TA-02` trở đi):** khi hoàn thành task, cập nhật cột `app` trong `15-perf-security-checklist.md` cho **mọi hạng mục mà scope task chạm tới** sang 🟢 kèm evidence; task **không được `DONE`** nếu còn hạng mục liên quan ở 🟡/⚪. Phần `Nghiệm thu và test` của mỗi task phải trỏ mã hạng mục đã đạt (vd `A01`, `A07`, `E5`).

**Task cũ:** `TA-00`, `TA-01` đã `DONE` trước khi có checklist nên chưa được chứng nhận; trạng thái trong tracker là tạm tính, chủ dự án sẽ chốt cách xử lý — không tự ý nâng trạng thái khi chưa có evidence mới.

---

## TA-00 — Scaffold, contracts, shell và API client

- Trạng thái: DONE
- Owner: `codex/root`
- Started: 2026-07-15
- Completed: 2026-07-15
- Commit lookup: `git log --oneline --grep='TA-00' -1`
- Evidence: local desktop UI review đã xử lý alignment Lucide icon/text; deep link `/dashboard` và `/classes/class-01` trả `200`; `pnpm --filter tutor-app lint`, `test` (15 tests) và `build` pass; `pnpm --filter @kimthanh-tutor/contracts test` pass; `docker compose run --rm verify` pass health/ready/error envelope/OTP/auth-me/database checks.
- Mock: `app/styles.css`, `app/app.js`, `app/mock-data.js`, shell của mọi màn, `settings.html`, `index.html`.

Scope:

- Scaffold package TypeScript/React theo baseline trong `09`; thêm scripts dev/build/lint/test và root workspace integration.
- Dựng design tokens, sidebar/topbar/mobile nav, route layout, 404/error boundary, loading/skeleton/empty primitives theo mock; launcher `index.html` không thành route sản phẩm.
- Dựng typed API client có refresh single-flight, normalized error, request ID, timeout/abort, `Idempotency-Key`, UTC/VND formatter và route guards dạng capability.
- Audit/mở rộng `@kimthanh-tutor/contracts`: sửa các shape lệch như tutor card/fee/media, bổ sung page/response/status cần cho app; thêm serialization contract tests đối chiếu API thật.
- Production không có chỉnh API base, clear localStorage hoặc hiển thị token. Chỉ cho dev diagnostics qua build flag.

Nghiệm thu và test:

- Deep link và refresh tất cả route shell không 404; desktop/mobile/keyboard focus đúng; 401 refresh một lần, 403 không retry vô hạn.
- Unit test API client, token-expiry race, error mapper, format UTC/VND; component test shell/nav/error boundary.
- `pnpm --filter tutor-app lint && pnpm --filter tutor-app test && pnpm --filter tutor-app build`; cURL health/auth error envelope trong `verify-api-io.sh` vẫn pass.

## TA-01 — Auth, role tutor và legal consent gate

- Trạng thái: DONE
- Owner: `codex/root`
- Started: 2026-07-17
- Completed: 2026-07-17
- Commit lookup: `git log --oneline --grep='TA-01' -1`
- Evidence: 29 unit/integration test `tutor-app` pass (OAuth callback mapper, OTP two-step/sai mã, open-redirect `next` allowlist, pending consent, wrong role parent-only, suspended, document đổi version, scroll gate); `pnpm --filter tutor-app lint`, `test`, `build` xanh; `pnpm --filter @kimthanh-tutor/contracts test` pass; backend `auth.controller.spec.ts` 6 tests pass (logout thu hồi refresh token). `verify-flow-01-auth-consent.sh` pass end-to-end trên Docker DB cô lập (`kt-ta01-flow01`, đã dọn sạch container/network/volume): OTP → từ chối consent khi `scroll_reached_bottom=false` (`400 VALIDATION_ERROR`) → consent hợp lệ → `/auth/me` active → logout `204` → refresh cũ `401 AUTH_REQUIRED`. Deep-link smoke qua `vite preview`: `/`, `/login`, `/consent`, `/profile`, `/dashboard` đều `200` (SPA fallback). Browser visual skill không khả dụng trong phiên (`browsers.list=[]`); hành vi được phủ bằng component/integration tests + HTTP smoke thay cho ảnh chụp.
- Blocker: —
- Mock: `login.html`, `consent.html`. API: Auth & Consent. Flow 1.

Scope:

- Google/Facebook OAuth thật theo server contract; OTP fallback gửi `{channel,destination}`, giữ `request_id`, verify `{request_id,code}`; không thêm email/password vì API không hỗ trợ.
- Sau auth gọi `/auth/me`, kiểm tra role/status; active user chưa có tutor profile được phép bootstrap ở TA-02; parent-only bị chặn và có link về market.
- Legal gate full-screen không đóng: tải terms/privacy active, hiển thị version/link/checksum, chỉ bật checkbox/nút sau scroll 100%, POST một consent gồm hai document ID và consent metadata.
- Wire `decideRouteAccess` vào route tree bằng auth snapshot thật trước khi bất kỳ protected screen/data nào render; không giữ scaffold bypass hoặc snapshot mặc định trong production. Mọi nhánh `auth/consent/role/suspended` phải điều hướng vào màn an toàn tương ứng.
- Giữ allowlist cho `next`, xử lý refresh/logout/suspended/pending_consent và retry có giới hạn.

Nghiệm thu và test:

- Không route protected nào render data trước khi auth+consent hợp lệ; sai OTP/cooldown/document đổi version có state rõ.
- Test OAuth callback mapper, OTP two-step, open-redirect, scroll gate, pending consent và wrong role.
- Chạy unit service API nếu phải refactor auth/cookie; `verify-flow-01-auth-consent.sh` pass và thêm case không thể consent với `scroll_reached_bottom=false`.

## TA-02 — Hồ sơ gia sư, media và publish

- Trạng thái: TODO
- Commit: —
- Mock: `profile.html`. API: Tutors + media. Flow 2, 11.

Scope:

- Form draft/edit typed đúng DTO: display name, bio, region/voice/gender/education/school/year/exam/GPA, subject, grade 1–12, teaching modes, fee range và offline areas chuẩn code.
- Checklist publishable lấy từ rule/server error, không tự đặt status `pending_review`; render `draft/publishable/published/hidden/suspended` đúng contract.
- Upload avatar/video thật: validate MIME/size, xin signed URL với `kind/content_type/size`, PUT file, lưu media ID; hiển thị scan/moderation/pending/rejected state. Nếu API chưa có finalize/status/public avatar URL thì bổ sung owner-safe endpoint và test trong task.
- Preview trên chợ dùng cùng presenter với public card nhưng gắn nhãn thông tin tự khai; không tuyên bố eKYC.

Nghiệm thu và test:

- Không publish khi thiếu field bắt buộc; offline bắt buộc area; fee min <= max; numeric enums map đúng; lỗi moderation có hướng sửa.
- Test form mapper, completeness, upload failure/expired URL, publish validation và hidden/suspended states; API ownership/media test nếu refactor.
- `verify-flow-02-tutor-profile.sh` và moderation phần tutor/media của Flow 11 pass.

## TA-03 — Lịch available/busy theo tuần

- Trạng thái: TODO
- Commit: —
- Mock: `availability.html`. API: tutor availabilities. Flow 2.

Scope:

- Dựng grid tuần/list responsive; map `day_of_week` 0–6 và `type=available|busy`, không dùng `online|offline` làm loại lịch.
- Tạo/xóa slot với HH:mm, validation start < end, optimistic UI có rollback; cảnh báo overlap ở client và hiển thị lỗi server.
- Đối chiếu nhu cầu “lịch học ở trường/lịch dạy/rảnh”. Nếu cần phân loại chi tiết để UX có nghĩa, refactor enum/schema/API trong cùng task và cập nhật docs thay vì nhét vào note.

Nghiệm thu và test:

- Timezone/day mapping đúng ở đầu/cuối tuần; empty, overlap, invalid time, delete ownership và concurrent delete được xử lý.
- Unit test mapper/grid coverage/overlap; component test create/delete; service test nếu thêm overlap rule.
- Flow 2 availability cURL pass; thêm case slot sai giờ và xóa slot không thuộc tutor.

## TA-04 — Dashboard “việc cần làm hôm nay”

- Trạng thái: TODO
- Commit: —
- Mock: `dashboard.html`. API: profile/trials/classes/lesson logs/QR/subscriptions.

Scope:

- Tổng hợp trạng thái hồ sơ, pending trials, lớp active/trial_accepted, QR pending và subscription QR từ API thật bằng query song song có failure isolation.
- API hiện không có endpoint lesson-log toàn tutor và class list không đủ dữ liệu để tính widget như mock. Hoặc bổ sung `GET /dashboard/tutor/overview` dạng aggregate owner-safe/không N+1, hoặc giản lược widget theo dữ liệu thật; quyết định và test nằm trong task này.
- Không tự suy ra “quá hạn ghi sổ” từ thời gian log nếu chưa có lesson schedule. Hiển thị “hoạt động gần nhất/chưa có log” hoặc bổ sung lesson schedule domain/API có tài liệu và test.
- CTA chỉ xuất hiện khi capability/dependency hợp lệ: không tạo QR trước payout+subscription, không ghi log cho lớp không thuộc tutor.

Nghiệm thu và test:

- Dashboard usable khi một widget lỗi; không flash dữ liệu cũ sau logout/switch user; mobile priority đúng.
- Test aggregator/presenter, partial error, empty state, capability CTA; targeted cURL cho các endpoint đọc của Flow 6/10.

## TA-05 — Inbox yêu cầu học thử

- Trạng thái: TODO
- Commit: —
- Mock: `trials.html`. API: Trials. Flow 4, 5, 6.

Scope:

- List/filter các trạng thái `pending/accepted/declined/expired/cancelled`; hiển thị request detail và lịch/contact theo policy đã chốt, không lộ quá quyền.
- Accept/decline pending với double-submit guard, reason, optimistic-version conflict UI; accept render class link và activation delivery state thay vì chỉ toast.
- Cảnh báo xung đột lịch dựa trên availability nếu API cung cấp; nếu chưa có, không khẳng định “không trùng lịch”.

Nghiệm thu và test:

- Chỉ pending có action; double accept và parent cancel race hiển thị state mới; decline reason được trim/validate.
- Component test filters/actions/conflict; API service unit test nếu response cần thêm capability/activation status.
- `verify-flow-04-guest-trial-activation.sh`, `05-parent-onboarding-trial.sh`, `06-tutor-inbox-lesson-log.sh` pass phần liên quan.

## TA-06 — Danh sách lớp, chi tiết và state machine

- Trạng thái: TODO
- Commit: —
- Mock: `classes.html`, `class-detail.html`. API: Classes. Flow 5, 6, 9.

Scope:

- Dùng đúng `trial_accepted/active/paused/completed_pending_review/completed/cancelled` từ contracts; bỏ `trial/ended` của mock.
- Group/list + detail owner-safe; nếu `GET /classes/:id` còn thiếu, ưu tiên thêm endpoint ownership-safe thay vì tải toàn list để dò khi dữ liệu lớn.
- Response class hiện chỉ có ID/subject/status/time, chưa đủ tên học sinh/phụ huynh, mode, fee và schedule như mock. Bổ sung relation summary owner-safe; chỉ thêm fee/mode/schedule vào domain/schema nếu đây là dữ liệu hợp đồng thật, nếu không phải giản lược UI và ghi rationale.
- Render transition theo capability/state machine; confirm pause/cancel/complete, gửi expected version nếu API được harden; complete dẫn sang pending review.
- Quick links lesson log/QR/review chỉ hiện khi capability hợp lệ.

Nghiệm thu và test:

- Không có transition trái state; concurrent transition trả conflict và refresh; cancelled/completed không còn action sai.
- Test matrix state/actor/action; component test confirm/conflict/deep link; service test ownership/optimistic lock khi refactor.
- Flow 5/6/9 cURL pass, thêm transition invalid và lớp của tutor khác.

## TA-07 — Tạo, xem và sửa sổ đầu bài

- Trạng thái: TODO
- Commit: —
- Mock: `lesson-logs.html`. API: lesson logs. Flow 6, 7.

Scope:

- Route theo class ID; list keyset, create qua `/classes/:id/lesson-logs`, patch `/lesson-logs/:id`; không gửi `class_id` thừa trong body.
- Enum `good|normal|needs_review`; UTC/date picker chuyển đổi an toàn; validate subject/content/homework/note length.
- Đổi copy “ghi chú riêng” vì `tutor_note` được phụ huynh xem. Nếu thật sự cần private note, chỉ thêm field/schema sau khi cập nhật privacy/contract.
- Enforce edit window theo capability/error server, không suy đoán ở client.

Nghiệm thu và test:

- Create/edit cập nhật cache đúng; pagination không duplicate; lỗi ngoài edit window/ownership rõ ràng; keyboard form hoàn chỉnh.
- Test mapper timezone/enum, validation, pagination merge, edit restriction; API test ownership.
- `verify-flow-06-tutor-inbox-lesson-log.sh` và dashboard read của Flow 7 pass.

## TA-08 — Tài khoản nhận học phí

- Trạng thái: TODO
- Commit: —
- Mock: `payout-accounts.html`. API: tutor payout accounts. Flow 10.

Scope:

- List masked accounts, create account, default selection; không lưu/log/render lại số tài khoản đầy đủ sau submit.
- Bank code chọn từ danh mục cấu hình; account holder/number validation; banner nền tảng không thu hộ.
- Mock chưa có delete/edit/set-default riêng. Không tạo action giả; nếu sản phẩm cần, bổ sung endpoint ownership/audit/privacy và cURL trong task sau khi rule được chốt.

Nghiệm thu và test:

- Default update nhất quán; form reset không giữ PII; screenshot/test output chỉ dùng masked fixture.
- Test masking UI, boolean mapper, validation/error; Flow 10 payout cURL và wrong-owner service test pass.

## TA-09 — Checkout và subscription `tutor_qr`

- Trạng thái: TODO
- Commit: —
- Mock: `billing.html`. API: Billing. Flow 10, 12.

Scope:

- Hiển thị giá/kỳ hạn/enabled từ backend. Nếu thiếu public/user product catalog, thêm endpoint read pricing an toàn; không hard-code 299k hay giá fallback.
- Checkout chỉ gửi `product_type=tutor_qr`, có idempotency key; render VietQR/transfer content/payment ID và poll với backoff/visibility pause.
- Xóa nút tự xác nhận thanh toán. Chỉ payment `paid`/subscription active mở tính năng; render pending/failed/expired/refunded/cancelled và policy cancel/auto-renew sau khi chốt.

Nghiệm thu và test:

- Sửa URL/client state không đổi amount; double click không tạo hai payment; reload tiếp tục poll payment đang pending.
- Test idempotency/poll state/disabled product; billing unit test nếu thêm catalog; `verify-flow-10-tutor-qr-tuition.sh` và pricing override Flow 12 pass.

## TA-10 — Tạo và quản lý QR học phí

- Trạng thái: TODO
- Commit: —
- Mock: `qr-records.html`. API: QR records. Flow 10.

Scope:

- Gate bằng subscription/override thật + payout account; list/filter theo class, keyset nếu API được mở rộng; create amount/description/account và render `qr_url/payment_link/transfer_content` từ response.
- Banner rõ tiền vào tài khoản gia sư, nền tảng không xác nhận ngân hàng. Action dùng copy “Gia sư tự xác nhận đã thu”, có confirmation và idempotent UI.
- Không tạo QR cho class/payout không thuộc tutor, lớp không phù hợp hoặc gói hết hạn; server vẫn là nguồn enforcement.

Nghiệm thu và test:

- Pending/collected rõ; link/copy hoạt động; expired subscription sau khi mở modal vẫn bị server chặn đúng.
- Component test gate/create/mark; API ownership/subscription tests; `verify-flow-10-tutor-qr-tuition.sh` pass toàn bộ.

## TA-11 — Xem và report review của lớp

- Trạng thái: TODO
- Commit: —
- Mock: `review.html`. API: Reviews. Flow 9, 11.

Scope:

- GET class review, render capability flags và moderation status; tutor chỉ report, không sửa review.
- Report reason bắt buộc, confirmation, success state `disputed`; không hiển thị danh tính parent quá contract.
- Deep link từ completed class và notification; xử lý review hidden/no review/already disputed.

Nghiệm thu và test:

- Report một lần/idempotent UI; wrong-owner/parent actor bị chặn; copy gọi đúng “đánh giá lớp/gia sư”.
- Component test capability/status/report; `verify-flow-09-review-moderation.sh` và admin moderation Flow 11 pass.

## TA-12 — Trung tâm thông báo

- Trạng thái: TODO
- Commit: —
- Mock: `notifications.html`. API: Notifications. Flow 6/9/10 side effects.

Scope:

- Keyset list, unread badge, mark read idempotent; map kind/link bằng allowlist route nội bộ, không điều hướng URL tùy ý.
- Notification row có loading/error/retry; cache badge đồng bộ sau mark-read; hỗ trợ event trial/class/log/billing/review.
- Không tuyên bố realtime khi outbox worker/push chưa có; polling/focus refresh được ghi rõ.

Nghiệm thu và test:

- Link độc hại bị bỏ; unread không âm/nhảy sai; ownership fail closed.
- Test pagination/read/link mapper; targeted notification cURL hoặc bổ sung Flow 6/9/10 khi worker đã có.

## TA-13 — PWA, accessibility và E2E xuyên app

- Trạng thái: TODO
- Commit: —
- Mock: toàn bộ `app`; phụ thuộc mọi feature task.

Scope:

- PWA manifest/icon/offline shell hợp lý, không cache response PII/auth; install/update UX và network offline state.
- Accessibility audit: landmarks, label/error association, focus trap/restore modal, keyboard grid, color contrast, reduced motion.
- Playwright E2E bằng API thật: auth/consent → profile → availability → accept trial → class → lesson log; payout → buy QR → create/mark collected; class complete → report review.
- Xóa toàn bộ mock/localStorage business state, dead dev route/copy, console log và hard-coded price.

Nghiệm thu và test:

- Lighthouse/accessibility baseline được ghi lại; mobile 360px và desktop smoke pass; logout/xóa cache không còn dữ liệu user trước.
- Full `pnpm lint/test/build`, Playwright suite, Flow 1/2/5/6/9/10/12 và `verify-api-io.sh` pass; evidence ghi vào task trước `DONE`.
