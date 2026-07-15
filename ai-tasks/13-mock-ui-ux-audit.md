# Audit Mock UI/UX Và Luồng Xuyên App

Ngày audit: 2026-07-15.

Phạm vi đã đọc: toàn bộ HTML/CSS/JS trong `kimthanh-tutor-mock/public/app`, `market`, `admin`; README ba app; API controller/DTO/service liên quan; `ai-docs` và flow cURL hiện có.

## 1. Bản đồ hành trình xuyên app

| Hành trình | `tutor-market` | `tutor-app` | `tutor-admin` | API/flow |
| --- | --- | --- | --- | --- |
| Tìm và mở khóa gia sư | search → tutor detail → checkout/payment | profile publish | pricing/payment/moderation | Flow 2, 3, 8, 11, 12 |
| Dạy thử thành lớp | trial form/status | trial inbox → accept → class detail | user/log audit | Flow 4, 5, 6 |
| Kích hoạt phụ huynh | activation → auth → consent | accept trả activation token/link | user detail | Flow 5 |
| Theo dõi học tập | students → dashboard/paywall | lesson logs | paid override/logs | Flow 6, 7, 12 |
| Đánh giá | completed class → review | class complete → view/report review | moderation | Flow 9, 11 |
| QR học phí | không phải thanh toán nền tảng | payout → buy QR plan → create QR → mark collected | pricing/paid override | Flow 10, 12 |

## 2. Inventory `tutor-app`

| Mock | Màn/ý đồ | Task |
| --- | --- | --- |
| `login.html`, `consent.html` | OAuth/OTP và cổng pháp lý | TA-01 |
| `dashboard.html` | việc cần làm hôm nay | TA-04 |
| `profile.html` | hồ sơ, media, checklist/publish | TA-02 |
| `availability.html` | lịch available/busy theo tuần | TA-03 |
| `trials.html` | inbox accept/decline | TA-05 |
| `classes.html`, `class-detail.html` | danh sách, state machine, quick actions | TA-06 |
| `lesson-logs.html` | tạo/sửa sổ đầu bài | TA-07 |
| `payout-accounts.html` | tài khoản nhận học phí | TA-08 |
| `billing.html` | checkout/subscription `tutor_qr` | TA-09 |
| `qr-records.html` | tạo/xem/mark-collected QR học phí | TA-10 |
| `review.html` | xem/report review của lớp | TA-11 |
| `notifications.html` | notification inbox | TA-12 |
| `settings.html` | dev settings/session mock | TA-00/TA-13; không bê dev control vào production |
| `index.html` | launcher mock | không phải route sản phẩm |

## 3. Inventory `tutor-market`

| Nhóm mock | Màn canonical | Task/phân loại |
| --- | --- | --- |
| `index.html`, `search.html` | search/filter/list | TM-01; `search.html` chỉ alias |
| `tutor.html`, `tutor-detail.html` | preview/paywall/unlocked detail | TM-02; alias không phải màn mới |
| `login.html`, `consent.html` | OAuth/OTP/legal | TM-03 |
| `parent-profile.html`, `account.html` | hồ sơ phụ huynh/gói | TM-04/TM-08; alias |
| `students.html`, `student-form.html` | CRUD học sinh | TM-04 |
| `trial-form.html`, `trials.html` | guest/parent trial, trạng thái/cancel | TM-05 |
| `classes.html` | lớp thuộc phụ huynh | TM-06 |
| `dashboard.html` | overview miễn phí/detail có paywall | TM-07 |
| `subscribe.html`, `subscriptions.html`, `checkout.html`, `payment.html` | catalog/gói/checkout/status | TM-08; alias |
| `review.html`, `notifications.html` | review và inbox | TM-09 |
| `favorites.html`, `compare.html` | lưu/so sánh gia sư | TM-11 hậu MVP, chưa có API |
| `messages.html`, `thread.html`, `schedule.html` | chat/lịch | TM-12 hậu MVP, chat realtime ngoài scope |
| `invoices.html`, `help.html`, `report.html` | tài chính/hỗ trợ | TM-13 hậu MVP, chưa có API |
| `apply-tutor.html`, `referral.html` | supply/growth | TM-13 hậu MVP, chưa có rule/API |
| `overview.html`, `settings.html` | screen map/dev control | chỉ dev route, không public production |
| `not-found.html` | 404 | TM-00 |

## 4. Inventory `tutor-admin`

| Mock | Màn/ý đồ | Task |
| --- | --- | --- |
| `login.html` | đăng nhập admin | AD-00 |
| `overview.html` | KPI vận hành | AD-01 |
| `users.html`, `user-detail.html` | lọc/detail/suspend/reactivate | AD-02 |
| `paid-features.html` | entitlement + override | AD-03 |
| `moderation.html` | tutor/media/review queue | AD-04 |
| `payments.html`, `refunds.html` | tra cứu/payment detail/refund | AD-05 |
| `logs.html` | audit/webhook/outbox | AD-06 |
| `platform-payment.html`, `pricing.html` | VietQR platform/pricing | AD-07 |
| `notifications.html` | cảnh báo vận hành | AD-08, backend chưa hỗ trợ admin notification |
| `settings.html` | environment/session/dev reset | AD-00/AD-09; bỏ demo reset khỏi production |
| `index.html` | launcher mock | không phải route sản phẩm |

## 5. Lỗi/sai lệch cần sửa trước hoặc trong task

| ID | Mức | Phát hiện | Hướng xử lý/task |
| --- | --- | --- | --- |
| UX-001 | Critical | Market checkout nhận `amount` từ query string; client có thể sửa giá. | Checkout chỉ gửi `product_type/target_ref_id`; server trả amount/pricing. TM-02, TM-08, TA-09. |
| UX-002 | Critical | Mock có nút “Tôi đã thanh toán” tự bật gói QR bằng localStorage. | Xóa hoàn toàn; chỉ webhook `paid` cấp quyền, UI poll API. TA-09. |
| UX-003 | Critical | Consent tutor được tick sẵn, không scroll, không document/version; market gửi sai DTO từng document. | Full-screen non-dismissible; tải active docs; scroll 100%; POST hai ID cùng `scroll_reached_bottom`. TA-01, TM-03. |
| UX-004 | Critical | Login mock OTP gửi `{phone}`/verify `{phone,code}`, khác API `{channel,destination}` và `{request_id,code}`; OAuth chỉ giả lập. | Typed auth client + provider SDK/config + request ID. TA-01, TM-03, AD-00. |
| UX-005 | Critical | Mock tutor class dùng `trial/ended`; API dùng `trial_accepted/completed_pending_review/completed/cancelled`. | Dùng state machine từ contracts, confirm destructive transition, optimistic conflict UI. TA-06. |
| UX-006 | Critical | Market dashboard đọc `avg_absorption/items/taught_at/absorption`, khác response `summary`, `timeline.items`, `lesson_at`, `absorption_level`. | Typed mapper và biểu đồ theo enum/count thực. TM-07. |
| UX-007 | High | `tutor.html` kiểm tra `(unlock_via || []).includes(...)` dù `unlock_via` là string/null và sản phẩm nằm ở `paywall.products`; paywall có thể không có CTA. | Render capability từ `unlock_state` + `paywall.products`. TM-02. |
| UX-008 | High | Search gửi grade dạng “Lớp 9”, API nhận số 1..12; avatar field cũng lệch `avatar_url`/`avatar_media_id`. | Chuẩn hóa option value; quyết định API media URL an toàn. TM-01/API refactor nếu cần. |
| UX-009 | High | Mock hiển thị rating/count trên thẻ search và detail locked, trong khi business doc nói rating/review bị khóa; backend hiện vẫn trả rating. | Chốt một rule. Đề xuất ẩn rating khỏi preview và API public card; vẫn có thể sort server-side. TM-01/TM-02 + API test/doc. |
| UX-010 | High | Mock tuyên bố “5.000 gia sư đã xác minh danh tính & bằng cấp”, “Đã xác minh”, “hoàn tiền nếu không hài lòng” nhưng MVP không eKYC/CCCD và refund chưa chốt. | Đổi copy thành “thông tin tự khai/đã duyệt nội dung” đúng capability; bỏ cam kết refund. TM-01/TM-02. |
| UX-011 | High | Mock nói mở khóa hồ sơ 30 ngày, tài liệu đã chốt vĩnh viễn; các mức giá mock 29k/149k/199k/299k khác backend 49k/69k/150k/30k. | Giá/kỳ hạn lấy API; copy single unlock “không hết hạn” khi entitlement đúng. TM-02/TM-08/TA-09. |
| UX-012 | High | Tutor availability dùng day `Mon` và type `online/offline`; API dùng day 0..6 và type `busy/available`. | Thiết kế lịch bận/rảnh đúng nghiệp vụ; teaching mode không đồng nghĩa availability type. TA-03. |
| UX-013 | High | Tutor profile mock field/enum lệch API: full_name/headline/string grade/year/score/offline text; media request thiếu content type/size. | Form model typed, split fields hợp lệ, upload thực qua signed URL, moderation states. TA-02. |
| UX-014 | High | Lesson log mock dùng `avg`, API enum là `normal`; gửi `class_id` trong body thay vì path; “ghi chú riêng” thực tế được phụ huynh xem qua dashboard. | Dùng enum chuẩn; đổi label thành nhận xét phụ huynh xem được hoặc thêm private field có schema riêng sau khi chốt. TA-07. |
| UX-015 | High | Trial guest mock gửi nested `contact`, API cần flat fields; mock không có cancel phía parent và activation screen. | TM-05/TM-03. |
| UX-016 | High | Mock student edit gọi `GET /parents/me/students/:id` nhưng API không có; UI có school/gender/notes còn DTO chỉ name/grade/learning_goals. | Dùng list/cache hoặc thêm owner-safe GET; chỉ giữ field sau privacy/schema review. TM-04. |
| UX-017 | High | Mock admin tự đăng nhập bằng localStorage, không gọi auth thật/role guard; settings lộ demo token. | Shared auth + verify role admin + session expiry; không render token. AD-00. |
| UX-018 | High | Admin refund mock đánh dấu completed ngay; backend chỉ POST refund và chính sách/manual transfer chưa chốt, chưa có GET refunds. | Không khẳng định tiền đã hoàn; thêm status workflow/list API nếu màn được giữ. AD-05. |
| UX-019 | High | Admin notifications mock chưa có endpoint/role tương ứng. | Thêm admin operational notifications có redaction hoặc bỏ màn MVP. AD-08. |
| UX-020 | Medium | Parent profile mock gửi phone/province và student gửi full_name/school/gender/notes, khác DTO. | Chỉ render field có contract hoặc refactor có classification/retention. TM-04. |
| UX-021 | Medium | Tutor dashboard suy ra “lớp cần ghi sổ” bằng khoảng thời gian từ log, không có lesson schedule API nên dễ báo sai. | Tạm hiển thị last activity rõ nghĩa; muốn overdue thật phải thêm lịch buổi học domain/API. TA-04. |
| UX-022 | Medium | Market chứa nhiều feature ngoài MVP và API giả: favorites, chat, compare, schedule, invoice, FAQ/ticket, report, apply, referral. | Không đưa vào nav MVP; giữ task hậu MVP TM-11–TM-13. |
| UX-023 | Medium | Settings của cả ba mock cho đổi API base/clear localStorage ở UI sản phẩm. | Chỉ giữ dev-only route sau build flag; production dùng env và logout. Scaffold/hardening tasks. |
| UX-024 | Medium | Shell mock không thể hiện 401 refresh, 403 role, pending consent, suspended account và offline/retry semantics. | API client + route guards + error boundaries ở task scaffold/auth. |
| UX-025 | Medium | `review.html` market gọi “đánh giá buổi học/báo cáo buổi học”, domain là đánh giá lớp/gia sư; report là quyền tutor, không phải parent. | Đổi copy/capability; parent create/edit, tutor report. TM-09, TA-11. |
| UX-026 | Medium | Avatar public API chủ yếu trả media ID, frontend cần URL; signed URL mới được implement cho intro video. | Chốt public-approved avatar delivery/CDN URL trong API, test không lộ media pending. TM-01/TA-02. |
| UX-027 | Medium | Contract package `TutorSearchCard` dùng `expected_fee_*`/`avatar_url`, backend card dùng `fee_*`/`avatar_media_id`; package còn thiếu phần lớn response types. | Mở rộng/sửa `packages/contracts` ở scaffold đầu tiên và thêm contract serialization tests. TA-00/TM-00/AD-00. |
| UX-028 | Medium | `tutor-admin` chưa nằm trong `pnpm-workspace.yaml`, root scripts không build/test app này. | AD-00. |
| UX-029 | High | `/classes/mine` chỉ trả ID/subject/status/time, trong khi mock cần tên học sinh/phụ huynh/gia sư, mode, fee, schedule; mock market còn nhầm class contract với từng buổi học. | Bổ sung relation summary owner-safe; chỉ mở rộng domain cho fee/mode/schedule khi rule được chốt. TA-06, TM-06. |
| UX-030 | Medium | Tutor dashboard mock cần lesson logs toàn tutor để tính “cần ghi sổ”, nhưng API chỉ list log theo từng class; gọi tuần tự sẽ thành N+1 và vẫn không có lịch buổi học. | Thêm tutor overview aggregate hoặc giản lược widget theo dữ liệu có thật. TA-04. |

## 6. Đề xuất UX bổ sung

- Mọi mutation tiền/trạng thái có double-submit guard, confirmation theo mức rủi ro và thông báo kết quả chứa mã tham chiếu.
- Deep link sau login phải được allowlist route nội bộ; không redirect tùy ý từ `next` để tránh open redirect.
- Search/filter đồng bộ URL để back/forward/share hoạt động; cursor không đưa vào URL công khai sau khi append.
- Paywall nêu rõ nội dung bị khóa, quyền nhận được, kỳ hạn do server trả về và trạng thái hoàn tiền chưa cam kết.
- Các màn trẻ em chỉ hiển thị tối thiểu dữ liệu cần thiết; không đưa tên đầy đủ vào analytics/log/error report.
- Admin table có keyset “Tải thêm”, filter giữ trong URL, mutation bắt buộc reason ở cả UI lẫn server; detail không bao giờ unmask PII.
- QR học phí luôn có banner “tiền chuyển thẳng cho gia sư; nền tảng không xác nhận số dư”. `mark-collected` dùng copy “Gia sư tự xác nhận đã thu”.
- Mỗi empty state có một CTA hợp lệ nhưng không dẫn người dùng qua paywall/quyền chưa có.

## 7. Vấn đề cần chủ dự án chốt, không được tự hard-code

1. Rating star/count có thật sự bị khóa ở thẻ preview không? Audit đề xuất tuân theo docs hiện tại: khóa.
2. Chính sách chia sẻ liên hệ sau unlock hay chỉ sau trial accepted.
3. Có giữ admin refund UI trong MVP khi hoàn tiền vẫn là thao tác chuyển khoản tay không.
4. Có giữ admin operational notifications hay dùng logs/moderation badge là đủ.
5. Các màn hậu MVP TM-11–TM-13 có được đưa vào release đầu hay ẩn hoàn toàn.

Cho tới khi được chốt, task phải dùng behavior an toàn hơn: không lộ rating/liên hệ, không hứa refund, không đưa feature chưa có API vào navigation production.
