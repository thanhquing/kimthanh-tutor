# Task List — `tutor-market` (Phụ Huynh/Khách)

Tất cả task khởi tạo ở trạng thái `TODO`. Quy tắc chung: `09-frontend-task-governance.md`. Audit mock/API: `13-mock-ui-ux-audit.md`.

Snapshot 2026-07-16: `TM-00` DONE với 17 test/lint/typecheck/build theo evidence bên dưới. Public SSR/SEO shell đã có nhưng search/detail/private business behavior từ `TM-01` trở đi vẫn TODO.

MVP gồm TM-00 đến TM-10. TM-11 đến TM-13 bao phủ các màn mock ngoài phạm vi hoặc chưa có API; không đưa chúng vào navigation production trước khi chủ dự án kích hoạt scope.

## Thứ tự đề xuất

| Thứ tự | Task | Phụ thuộc | Release | Trạng thái |
| --- | --- | --- | --- | --- |
| 1 | TM-00 Scaffold, contracts, shell/API client | — | MVP | DONE |
| 2 | TM-01 Guest search/filter/card | TM-00 | MVP | TODO |
| 3 | TM-02 Tutor detail, paywall, unlock CTA | TM-01 | MVP | TODO |
| 4 | TM-03 Auth, activation và legal consent | TM-00 | MVP | TODO |
| 5 | TM-04 Parent profile và student CRUD | TM-03 | MVP | TODO |
| 6 | TM-05 Guest/parent trial request và trạng thái | TM-02, TM-03, TM-04 | MVP | TODO |
| 7 | TM-06 Lớp của phụ huynh | TM-03, TM-05 | MVP | TODO |
| 8 | TM-07 Dashboard tracking/paywall | TM-04, TM-06 | MVP | TODO |
| 9 | TM-08 Product catalog, checkout, payment, subscription | TM-03, TM-04 | MVP | TODO |
| 10 | TM-09 Review và notification | TM-06, TM-08 | MVP | TODO |
| 11 | TM-10 PWA/accessibility/E2E | TM-01–TM-09 | MVP | TODO |
| 12 | TM-11 Favorites và compare | TM-02 | Hậu MVP | TODO |
| 13 | TM-12 Messages và schedule | TM-06 | Hậu MVP | TODO |
| 14 | TM-13 Invoice/help/report/apply/referral | TM-03, TM-08 | Hậu MVP | TODO |

---

## TM-00 — Scaffold, contracts, shell và API client

- Trạng thái: DONE
- Owner: codex/root
- Completed: 2026-07-15
- Commit lookup: `git log --oneline --grep='TM-00' -1`
- Review: Chủ dự án xác nhận shell/layout phải bám HTML/CSS mock, không tự sáng tạo visual ngoài scope.
- Evidence: 17 `tutor-market` tests; contracts serialization test; lint, typecheck và production build pass; Docker `verify-api-io.sh` pass; cURL public/private/sitemap/404 với API thật trả đúng status, canonical/OG và robots redaction.
- Mock: `market/styles.css`, `api.js`, `shell.js`, `not-found.html`, dev-only `overview.html/settings.html`.

Scope:

- Scaffold TypeScript/React bằng framework hybrid SSR + SPA (đề xuất Next.js App Router), scripts và root workspace; route shell responsive theo mock, 404/error boundary/loading/empty/toast/modal primitives.
- Typed API client chung semantics với tutor app: refresh single-flight, normalized error, abort, idempotency, UTC/VND, auth/consent/capability guards.
- Mở rộng/sửa `@kimthanh-tutor/contracts` cho search/public detail/parent/student/trial/class/dashboard/billing/review/notification; contract tests đối chiếu JSON thật.
- Canonical routes thay cho từng `.html`; alias `search/tutor-detail/parent-profile/subscriptions` redirect nội bộ có test. Screen map/API base/mock mode chỉ dev build, không ở production.
- Shell ưu tiên search cho guest; route dữ liệu trẻ em/parent không prefetch khi chưa auth.
- Chia route rõ ràng: public search/profile dùng Server Components + SSR/SSG/ISR; account/students/classes/dashboard/billing/checkout/notifications dùng client-side app behavior sau auth.
- Dựng nền SEO/share: server metadata API, canonical host env, robots, sitemap động cho tutor `published`, Open Graph dùng ảnh public approved, JSON-LD, cache/revalidation và `noindex,nofollow` cho toàn bộ route login-only.

Nghiệm thu và test:

- Guest vào `/` thấy search ngay; deep link/refresh hoạt động; 401/refresh/403/pending consent không loop; mobile nav đúng quyền.
- `curl`/view-source của public route có title/canonical/OG mà không cần chạy JS; private route có `noindex,nofollow`, không chứa protected data và vẫn chuyển trang mượt kiểu SPA sau login; sitemap không chứa profile hidden/suspended/private route.
- Unit API client/contract/error/metadata mapper; component shell/nav/404/open redirect; lint/test/build package và `verify-api-io.sh` pass.

## TM-01 — Guest search, filter và tutor preview card

- Trạng thái: TODO
- Commit: —
- Mock: `index.html`, `search.js`, alias `search.html`. API: Search. Flow 3.

Scope:

- Search public không auth; filter subject, grade numeric 1–12, mode, gender, region/voice/education/school/score/GPA/fee/province/district theo contract; filter state sync URL.
- Keyset “Tải thêm”, sort, skeleton/empty/error/retry, abort request cũ và responsive filter drawer; không dùng offset hay hiển thị fake total khi API không trả total.
- Tutor card chỉ hiển thị preview được phép. Theo rule an toàn hiện tại: ẩn rating/count; bỏ claim “đã xác minh danh tính/bằng cấp” và dùng copy “thông tin tự khai/đã duyệt” đúng data.
- Refactor API/contracts nếu cần URL avatar approved an toàn. Không public media pending/rejected; không N+1 signed URL.
- Search result link dùng canonical tutor URL có ID ổn định và slug đọc được; đổi display name không tạo duplicate content, slug cũ redirect canonical nếu triển khai slug persistence.

Nghiệm thu và test:

- Fee invalid/client+server validation; back/forward giữ filter; cursor append không duplicate; guest không bị đẩy login.
- Test query mapper, URL state, race/abort, card redaction, pagination; search adapter/serialization test nếu API đổi.
- `verify-flow-03-guest-search-paywall.sh` pass và thêm assertion không lộ field locked/rating/media chưa duyệt theo rule đã chốt.

## TM-02 — Tutor detail, paywall và unlock CTA

- Trạng thái: TODO
- Commit: —
- Mock: `tutor.html`, alias `tutor-detail.html`. API: public tutor detail. Flow 3, 8.

Scope:

- Render preview và `unlock_state`; sản phẩm khả dụng lấy `paywall.products`, quyền đã mở lấy `unlock_via` string/null. Không dùng logic `.includes` sai của mock.
- Paywall nói rõ video/bio/review bị khóa, single unlock vĩnh viễn theo decision hiện tại, VIP theo kỳ hạn server; giá không hard-code và không truyền amount trong URL.
- Unlocked detail render approved signed video, bio, published reviews và expiry refresh; contact vẫn ẩn cho tới policy được chốt.
- CTA trial tuân theo rule sản phẩm; copy bỏ “hoàn tiền nếu không hài lòng” và eKYC claim.
- Sinh metadata server-side riêng từng tutor cho Google/Facebook/Zalo/LinkedIn: title, mô tả preview, canonical absolute URL, `og:type`, approved avatar/social image và JSON-LD `ProfilePage`/`Person`. Dữ liệu locked không xuất hiện trong metadata, JSON-LD hay HTML hydration payload.
- Profile `hidden/suspended/deleted` phải biến mất khỏi sitemap và trả semantics `404`/`410` theo policy; không để bản cache cũ tiếp tục được crawler đọc.

Nghiệm thu và test:

- Locked không lộ data qua DOM/query cache; unlocked đúng tutor; expired/refunded relock; CTA checkout chứa chỉ product/target.
- Component test locked/unlocked/VIP/single/refund/error; metadata snapshot/redaction/canonical/hidden-profile tests; API access/serialization test nếu sửa paywall meta.
- `verify-flow-03-guest-search-paywall.sh` và `verify-flow-08-single-unlock-profile.sh` pass.
- Thêm cURL SEO smoke: HTML không cần JS vẫn có canonical + Open Graph, share image absolute/public và không chứa bio/review/contact locked.

## TM-03 — Auth, activation và legal consent

- Trạng thái: TODO
- Commit: —
- Mock: `login.html`, `consent.html`; mock còn thiếu màn activation. API: Auth/Consent/Activation. Flow 1, 4, 5.

Scope:

- Google/Facebook OAuth thật và OTP fallback đúng two-step request ID; không fake OAuth toast.
- Route `/activation`: nhận one-time token từ link, gọi activation complete atomically, nhận user/parent/class context rồi bắt consent trước khi vào parent area.
- Consent full-screen scroll 100%, terms+privacy IDs/version/checksum, không close; handle consumed/expired activation token và active consent version.
- `next` allowlist, wrong role/suspended/logout/refresh; bootstrap parent profile chỉ sau active consent.

Nghiệm thu và test:

- Guest trial accepted có thể hoàn tất activation đúng một lần; không tạo account active trước consent; expired/reused token rõ cách xử lý.
- Unit callback/OTP/activation mapper; component consent/open redirect/error; API test nếu activation response cần bổ sung.
- `verify-flow-01-auth-consent.sh`, `04-guest-trial-activation.sh`, `05-parent-onboarding-trial.sh` pass.

## TM-04 — Hồ sơ phụ huynh và CRUD học sinh

- Trạng thái: TODO
- Commit: —
- Mock: `account.html`, `students.html`, `student-form.html`, alias `parent-profile.html`. API: Parents & Students. Flow 5, 7.

Scope:

- Parent profile chỉ dùng `display_name/email` theo contract hiện tại; phone từ identity là read-only/masked nếu server trả. Không gửi `province` chưa có schema.
- CRUD student với `name/grade/learning_goals`, ownership fail closed, soft delete confirmation. School/gender/notes chỉ thêm sau classification/retention/API review; không lưu tạm client.
- Edit student dùng list cache hoặc bổ sung `GET /parents/me/students/:id` owner-safe + test/pagination contract; không gọi endpoint không tồn tại.
- Không đưa tên đầy đủ trẻ em vào analytics, error log, URL label hay snapshot fixture thật.

Nghiệm thu và test:

- Create/update/delete cache nhất quán; invalid/empty/other-parent ID bị chặn; account reload đúng response.
- Test form mapper/PII redaction/ownership states; parent service tests nếu thêm GET; Flow 5/7 cURL pass phần profile/student.

## TM-05 — Guest/parent trial request và trạng thái

- Trạng thái: TODO
- Commit: —
- Mock: `trial-form.html`, `trials.html`. API: Trials. Flow 4, 5.

Scope:

- Form tutor-specific: subject/grade/goal/mode/schedule/message; parent chọn own student; guest gửi flat `contact_name/contact_phone/contact_email` và được giải thích đây là lead.
- Xử lý paywall/contact policy đúng quyết định: không lộ contact; nếu trial chỉ được gửi sau unlock thì server+UI cùng enforce, nếu guest được gửi trước unlock thì copy phải rõ.
- Parent list/filter statuses và cancel chỉ pending; guest sau submit nhận reference/privacy notice mà không có route “mine”.
- Accept result/activation notification từ tutor app phải liên kết đúng tới TM-03.

Nghiệm thu và test:

- Guest rate-limit/spam error rõ; nested contact không còn; parent không gắn student người khác; cancel/accept race refresh đúng.
- Test payload mapper, guest/parent variants, capability/cancel; trials service tests nếu rule unlock thay đổi.
- `verify-flow-04-guest-trial-activation.sh` và `05-parent-onboarding-trial.sh` pass.

## TM-06 — Danh sách và chi tiết lớp của phụ huynh

- Trạng thái: TODO
- Commit: —
- Mock: `classes.html`, `schedule.html` chỉ dùng làm gợi ý presentation, không API riêng trong MVP. API: Classes. Flow 5, 7, 9.

Scope:

- List classes theo state contract, group active/upcoming/complete/cancelled dựa trên dữ liệu thật; không biến `ClassContract` thành từng buổi học như mock `MOCK_CLASSES`.
- Nếu cần detail route, bổ sung `GET /classes/:id` owner-safe/capabilities trong cùng task; không tải toàn bộ list để dò dài hạn.
- Response class hiện chỉ có ID/subject/status/time; bổ sung student/tutor display summary owner-safe để dựng list. Không giả `scheduled_at`/lesson title từ class contract và không thêm fee/schedule vào schema nếu chưa chốt domain.
- Parent chỉ transition khi state/action server cho phép; hiện flow chủ yếu tutor transition, nên không render nút tùy tiện.
- CTA dashboard theo student, review chỉ `completed_pending_review/completed`, display lịch chỉ khi domain thật có schedule.

Nghiệm thu và test:

- Parent khác không đọc lớp; state labels đúng; no fake scheduled_at; empty CTA dẫn search.
- Test state presenter/capability/deep links; service ownership nếu thêm detail; Flow 5/7/9 cURL pass phần class.

## TM-07 — Dashboard học tập và paywall tracking

- Trạng thái: TODO
- Commit: —
- Mock: `dashboard.html`. API: Dashboard. Flow 7.

Scope:

- Render overview đúng shape `student/summary/latest_lesson/classes`; không dùng `avg_absorption` giả nếu API không trả.
- Detail đọc `growth` enum counts và `timeline.items` với `lesson_at/absorption_level`; keyset load-more; presenter giải thích mức tiếp thu thay vì phần trăm giả.
- `PAYMENT_REQUIRED/SUBSCRIPTION_EXPIRED` render paywall cho đúng student target; giá/kỳ hạn lấy product metadata, không hard-code 149k.
- Hết hạn khóa detail nhưng không xóa/cache leak data; remove detail query khi logout/subscription invalid.

Nghiệm thu và test:

- Overview luôn xem được với own student; detail chỉ active tracking đúng student; gói con A không mở con B.
- Test response mapper, enum growth, keyset, cache purge, payment/expired states; dashboard API service tests nếu response đổi.
- `verify-flow-07-parent-dashboard-tracking.sh` pass và assertion cross-student entitlement.

## TM-08 — Product catalog, checkout, payment và subscriptions

- Trạng thái: TODO
- Commit: —
- Mock: `subscribe.html`, `checkout.html`, `payment.html`, account subscription section, alias `subscriptions.html`. API: Billing. Flow 7, 8, 12.

Scope:

- Thêm/đọc catalog sản phẩm user-safe từ backend pricing để UI biết amount/period/enabled; single unlock chỉ từ tutor detail, tracking bắt buộc student target, VIP không target.
- Checkout không nhận amount từ URL/body; idempotency key ổn định theo lần submit; render VietQR/transfer reference và poll backoff có resume.
- Payment state pending/paid/failed/cancelled/refunded/expired UI; redirect sau paid theo entitlement target; subscription list/cancel với copy “ngừng gia hạn” hoặc “hủy quyền ngay” đúng server rule.
- Không hứa refund/auto-renew khi open questions chưa chốt; handle product disabled và duplicate active/pending subscription.

Nghiệm thu và test:

- Client tamper không đổi amount; double submit idempotent; wrong target role/ownership fail; paid webhook mới mở quyền.
- Test catalog/checkout state machine/poll/reload/cancel; billing tests nếu thêm catalog; Flow 7/8/12 pricing cURL pass.

## TM-09 — Review lớp và trung tâm thông báo

- Trạng thái: TODO
- Commit: —
- Mock: `review.html`, `notifications.html`. API: Reviews/Notifications. Flow 9.

Scope:

- Review theo lớp/gia sư: GET capability flags, parent create/edit 1 review với rating 1–5 và editable window; không render “report” cho parent vì report review là quyền tutor.
- Hiển thị pending moderation/published/hidden/disputed, validation và privacy copy; completed class CTA đúng.
- Notification keyset/unread/read, internal-link allowlist cho trial/class/payment/review; badge cache nhất quán.

Nghiệm thu và test:

- Active class không review; parent khác không review; edit hết hạn bị chặn; rating 0 không submit; no malicious link redirect.
- Component/capability/pagination tests; `verify-flow-09-review-moderation.sh` pass và notification targeted cURL khi worker có.

## TM-10 — PWA, accessibility và E2E hành trình phụ huynh

- Trạng thái: TODO
- Commit: —
- Mock: toàn bộ market MVP.

Scope:

- PWA/offline shell không cache PII/API protected; install/update state; responsive 360px+, filter/modal focus/accessibility/contrast/reduced motion.
- SEO regression: sitemap/robots/canonical, SSR status code, metadata unique, structured-data parse, social preview image và cache invalidation khi tutor bị hide/suspend.
- Playwright API thật: guest search/locked detail → single unlock; guest trial → activation/consent; parent student/trial/classes; dashboard locked → buy tracking → detail; complete → review.
- Xóa mock API/data, fake counts/claims, dev links, hard-coded price và feature hậu MVP khỏi production nav.

Nghiệm thu và test:

- No protected data after logout/back/offline; all loading/error/empty/paywall routes tested; full lint/test/build/Playwright pass.
- Flow 1/3/4/5/7/8/9/12 và `verify-api-io.sh` pass; evidence mobile/desktop/accessibility được ghi trước `DONE`.

## TM-11 — Favorites và so sánh gia sư (hậu MVP)

- Trạng thái: TODO
- Commit: —
- Blocker: ngoài MVP, chưa có API/schema/rule retention.
- Mock: `favorites.html`, `compare.html`, nút lưu ở `tutor.html`.

Scope khi được kích hoạt:

- Chốt guest local vs parent synced, giới hạn 2–4 compare, retention/delete và visibility locked fields.
- Thêm schema/API owner-safe/keyset + contracts; UI save/remove/compare responsive. Compare không được dùng endpoint detail để bypass paywall.
- Unit/service/component tests, rate/ownership tests và flow cURL mới; cập nhật `03-product-scope`, `05`, `11`, `05-api-endpoints`, `07`.

## TM-12 — Messages và schedule (hậu MVP)

- Trạng thái: TODO
- Commit: —
- Blocker: chat realtime/video class ngoài MVP; chưa có domain/API/contact policy.
- Mock: `messages.html`, `thread.html`, `schedule.html`.

Scope khi được kích hoạt:

- Chốt chỉ mở thread sau trial accepted/class membership, retention/moderation/block/report, delivery/read state và PII/contact scanning.
- Chốt schedule là lịch class contract hay lesson sessions; thiết kế schema/API/outbox trước UI.
- Implement backend/contracts/UI/tests/load/security/cURL trọn gói; không dùng timer mock trả lời tự động.

## TM-13 — Invoice, help, report, apply tutor và referral (hậu MVP)

- Trạng thái: TODO
- Commit: —
- Blocker: nhiều feature độc lập chưa có API và rule; cần tách task con nếu được đưa vào scope thật.
- Mock: `invoices.html`, `help.html`, `report.html`, `apply-tutor.html`, `referral.html`.

Scope khi được kích hoạt:

- Invoice/receipt: chốt nghĩa pháp lý (nền tảng không thu học phí), dữ liệu payment/refund và endpoint download an toàn.
- Help/report: category, attachment, SLA, moderation/audit/retention; chống spam và không gửi raw PII vào log.
- Apply tutor: ưu tiên link sang auth/profile `tutor-app`, không tạo application domain trùng nếu không cần.
- Referral: chốt reward/fraud/accounting/tax trước schema/API/UI; không hứa 50k từ mock.
- Mỗi feature sau khi chốt nên tách thành một task/commit riêng; dòng TM-13 chỉ là placeholder inventory, không được đánh `DONE` bằng một commit gom tùy tiện.
