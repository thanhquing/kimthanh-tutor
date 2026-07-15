# Task List — `tutor-admin` (Vận Hành Nội Bộ)

Tất cả task khởi tạo ở trạng thái `TODO`. Quy tắc chung: `09-frontend-task-governance.md`. Admin là bề mặt rủi ro cao: role check, PII redaction, reason và audit log phải được kiểm tra ở server, không chỉ UI.

## Thứ tự đề xuất

| Thứ tự | Task | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- |
| 1 | AD-00 Scaffold, workspace, auth/RBAC, shell/API client | — | TODO |
| 2 | AD-01 Overview vận hành | AD-00 | TODO |
| 3 | AD-02 Users/detail/suspend/reactivate | AD-00 | TODO |
| 4 | AD-03 Paid feature entitlement/override | AD-02 | TODO |
| 5 | AD-04 Moderation tutor/media/review | AD-00 | TODO |
| 6 | AD-05 Payments và refund workflow | AD-00 | TODO |
| 7 | AD-06 Audit/webhook/outbox logs | AD-00 | TODO |
| 8 | AD-07 Platform VietQR và pricing | AD-00 | TODO |
| 9 | AD-08 Operational notifications | AD-01, AD-04, AD-05, AD-06 | TODO |
| 10 | AD-09 Security/accessibility/E2E hardening | AD-01–AD-08 | TODO |

---

## AD-00 — Scaffold, workspace, auth/RBAC và shell/API client

- Trạng thái: TODO
- Commit: —
- Mock: `admin/styles.css`, `admin/app.js`, `admin/mock-data.js`, `login.html`, `settings.html`, `index.html`.

Scope:

- Scaffold TypeScript/React app và thêm `tutor-admin` vào `pnpm-workspace.yaml`, root build/test/lint; route shell/sidebar/topbar/mobile nav/error boundary/404.
- Đăng nhập qua auth thật, gọi `/auth/me`, yêu cầu role `admin`; OTP demo vẫn phải đi qua request/verify contract, không set localStorage boolean. Handle pending consent nếu admin account cũng chịu legal policy, suspended và token expiry.
- Typed admin API client/contracts cho keyset lists, error/request ID, refresh, abort, reason mutations; production API base từ env.
- Bỏ hiển thị token, clear demo state, đổi environment/API base ở production. Environment badge là build metadata read-only.
- Security headers/deployment note: CSP/frame ancestors/noindex, không analytics session replay trên admin, idle/session timeout UX.

Nghiệm thu và test:

- Non-admin dù có token vẫn 403; direct deep link không flash admin data; logout/expiry clear cache; admin không bị open redirect.
- Unit API/auth/error/contract; component shell/RBAC/forbidden; root lint/test/build và Flow 1 admin-role setup/Flow 12 auth precondition pass.

## AD-01 — Overview vận hành

- Trạng thái: TODO
- Commit: —
- Mock: `overview.html`. API: `GET /admin/overview`. Flow 12.

Scope:

- KPI user/registration/moderation/payment/paid features theo response thật; date range URL state, timezone rõ và loading/partial error.
- Chart accessible/table fallback; link drill-down giữ filter sang users/moderation/payments/logs.
- Không gọi doanh thu học phí; chỉ platform product payments. Không hiển thị fake percent/trend nếu API không trả comparison.

Nghiệm thu và test:

- Range invalid bị chặn; empty period/large number/VND/timezone đúng; response không PII.
- Presenter/chart/component tests; admin overview service test nếu bổ sung comparison; Flow 12 overview cURL pass.

## AD-02 — Users, detail, suspend và reactivate

- Trạng thái: TODO
- Commit: —
- Mock: `users.html`, `user-detail.html`. API: admin users. Flow 12.

Scope:

- Keyset table/filter role/status/search/date đồng bộ URL; dùng status `pending_consent/active/suspended/deleted`, bỏ `pending_review` ở user filter.
- Detail hiển thị masked identity, roles/profiles/subscription/payment summary/overrides theo response thật; không có action unmask PII.
- Suspend/reactivate bắt reason, confirmation, self-suspend guard, concurrent state refresh; show effect revoke refresh sessions without claiming access token instantly revoked unless backend supports it.
- Nếu payment detail cần pagination thay vì summary, dùng admin payments endpoint với cursor, không fetch toàn bộ.

Nghiệm thu và test:

- Search không lưu raw query PII trong analytics; keyset no duplicate; self-suspend/wrong role/reason blank fail server; mutation writes audit.
- Component filter/detail/mutation tests; admin service unit tests; Flow 12 user list/detail/status/audit cURL pass.

## AD-03 — Paid feature entitlement và override

- Trạng thái: TODO
- Commit: —
- Mock: `paid-features.html`, section trong `user-detail.html`. API: admin paid features. Flow 12.

Scope:

- Hiển thị tách biệt entitlement từ payment/subscription và admin override cho `single_unlock/parent_vip/parent_tracking/tutor_qr`.
- Mutation enabled/disabled bắt reason, optional expiry ISO future; confirmation giải thích ảnh hưởng. Không dùng override để giả một specific tutor/student entitlement khi scope_ref bắt buộc mà API chưa biểu diễn rõ.
- Refactor contract/API nếu cần thể hiện scope/precedence/effective state; update docs và tests cùng task.

Nghiệm thu và test:

- Expired override không effective; disable precedence đúng Access/Billing services; wrong feature/target role/blank reason fail; audit readable nhưng không PII.
- Matrix tests entitlement × override × expiry; Flow 12 paid-feature cURL và regression Flow 7/10 pass.

## AD-04 — Moderation tutor, media và review

- Trạng thái: TODO
- Commit: —
- Mock: `moderation.html`. API: moderation queue/actions. Flow 11.

Scope:

- Queue theo ba tab tutor/media/review; counts từ response; preview chỉ dùng approved/signed/safe URL, không render executable/raw upload.
- Tutor publish/hide/suspend, media approve/reject + scan status, review publish/hide theo enum/action API; confirmation và reason UX.
- Backend hiện Tutor/Review/Media DTO chưa nhận reason ở một số action dù audit nhạy cảm yêu cầu reason. Refactor DTO/service/audit để reason bắt buộc trước khi nối UI.
- Refresh item sau mutation, handle already moderated/concurrent action và update rating/search side effect.

Nghiệm thu và test:

- Media infected không approve; pending scan copy rõ; hidden review cập nhật rating; no raw PII/contact; keyboard media preview an toàn.
- Component tab/action/conflict; service reason/audit/state tests; `verify-flow-11-admin-moderation-ops.sh` pass và bổ sung blank-reason cases.

## AD-05 — Payments và refund workflow

- Trạng thái: TODO
- Commit: —
- Mock: `payments.html`, `refunds.html`. API: admin payments/refunds. Flow 11, 12.

Scope:

- Payment keyset/filter/detail với product/status/payer; response redacted, show provider reference/status/amount/time nhưng không raw webhook/account.
- Refund chỉ cho eligible paid payment, amount <= refundable, reason bắt buộc, idempotent confirmation. Không tự gắn `completed`: phản ánh đúng manual/provider workflow và entitlement revocation policy.
- Backend chưa có GET refund/list/detail và refund policy còn open. Trước khi giữ màn “refund gần đây”, chốt state model rồi thêm endpoint/schema/contracts/test; nếu chưa chốt, UI MVP chỉ cho POST result thật và link audit.
- Handle partial/full/refunded/duplicate/concurrent refund và quyền thu hồi.

Nghiệm thu và test:

- Client không refund failed/pending hoặc quá amount; server vẫn validate; no double refund; audit và entitlement outcome đúng policy.
- Component filter/detail/refund states; billing/admin service tests; Flow 11 refund cURL + regression Flow 7/8/10 pass.

## AD-06 — Audit, webhook và outbox logs

- Trạng thái: TODO
- Commit: —
- Mock: `logs.html`. API: system logs/audit logs. Flow 12.

Scope:

- Tab/query type bắt buộc; keyset filters status/actor/entity/action; URL state và load more.
- Render summary/hash/reference, request ID/entity deep link khi an toàn; tuyệt đối không raw payload, secret, IP, token hay before/after PII.
- Phân biệt webhook received/processed/ignored/failed và outbox pending/processed/failed nếu contract có; không thêm retry button khi API chưa có safe operation.

Nghiệm thu và test:

- Redaction snapshot, malicious log text escaped, cursor/filter correct; list lớn không tải tất cả.
- Component pagination/filter/XSS tests; admin log service redaction tests; Flow 12 system log/audit cURL pass.

## AD-07 — Platform VietQR account và product pricing

- Trạng thái: TODO
- Commit: —
- Mock: `platform-payment.html`, `pricing.html`. API: platform account/pricing. Flow 12.

Scope:

- Platform account GET masked; PATCH account number mới + bank/holder/active + reason. Backend DTO hiện chưa có reason dù cấu hình nhạy cảm cần audit reason: bổ sung bắt buộc hoặc ghi rationale chuẩn trong server audit.
- Pricing list/edit amount integer VND, period days, enabled, reason; single unlock period null/vĩnh viễn, không cho UI gửi `0` vào DTO min 1.
- Confirmation nêu thay đổi chỉ áp dụng checkout mới; không lộ full account sau save; product disabled state phản ánh ngay ở apps qua catalog.

Nghiệm thu và test:

- Invalid account/amount/period/reason fail; masked response; concurrent edit refresh; pricing change không sửa payment cũ.
- Form/mapper/redaction tests; admin/billing unit regression; Flow 12 platform/pricing và Flow 7/8/10 checkout pass.

## AD-08 — Operational notifications

- Trạng thái: TODO
- Commit: —
- Blocker: backend notifications hiện chỉ cho parent/tutor; cần chốt có giữ màn admin hay dùng badges/logs.
- Mock: `notifications.html`.

Scope nếu giữ màn:

- Xác định event admin: moderation pending, payment anomaly/refund, webhook/outbox failure; severity, dedupe, retention và link entity.
- Mở rộng notification ownership/role hoặc endpoint admin riêng, outbox worker và redaction; keyset/read idempotent.
- UI inbox/filter/severity/unread badge/internal link allowlist. Không poll quá mức và không coi log thường là alert.

Nghiệm thu và test:

- Admin khác có thể đọc notification chung hay riêng phải được chốt; parent/tutor không đọc; no raw payload/PII; dedupe đúng.
- Backend worker/service tests, component tests và flow cURL mới; cập nhật docs `05/09/11/13/14` và endpoint catalog.

## AD-09 — Security, accessibility và E2E hardening

- Trạng thái: TODO
- Commit: —
- Mock: toàn bộ admin; phụ thuộc các task trước.

Scope:

- Playwright API thật: admin login → overview → users suspend/reactivate → override → moderation → payments/refund → logs → platform/pricing; wrong-role suite song song.
- Accessibility table/filter/modal/focus/keyboard/contrast; responsive desktop ưu tiên nhưng mobile critical actions vẫn dùng được.
- Security: CSP/noindex, cache-control protected pages, no token/PII in storage/log/error/snapshot, session expiry/idle, XSS fixtures, CSRF review theo token transport.
- Xóa mock/localStorage business state, demo token/API switch/fake values; root scripts/CI build test admin.

Nghiệm thu và test:

- Full lint/test/build/Playwright; Flow 11/12 và regression Flow 7/8/10 pass trên DB sạch.
- Evidence redaction, wrong-role, mobile/desktop/accessibility được ghi vào task trước khi `DONE`.
