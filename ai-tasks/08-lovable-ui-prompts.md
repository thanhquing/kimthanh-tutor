# Prompt Lovable Tạo Multi-Page HTML/CSS/JS

Dùng 3 prompt dưới đây cho Lovable. Mục tiêu là tạo **prototype nhiều file HTML**, mỗi màn hình là một file `.html` riêng, bấm qua lại như app thật, có mock data đầy đủ và tương tác bằng vanilla JS.

> **Trạng thái 2026-07-16:** file này là artifact lịch sử để tạo mock tĩnh, không phải hướng dẫn implement production. `TA-00`, `TM-00`, `AD-00` đã thay mock bằng scaffold thật; mọi `localStorage`, fake login, API switch, hard-coded price và claim marketing trong prompt chỉ phục vụ demo, tuyệt đối không copy vào code. Nguồn chân lý hiện tại là `09-frontend-task-governance.md`, `13-mock-ui-ux-audit.md`, task list và API/contracts đang chạy.

Quy tắc chung cho cả 3 app:

- Chỉ dùng HTML/CSS/vanilla JavaScript. Không React, Vue, Angular, npm, build tool.
- App chạy bằng cách mở file `index.html`.
- **Mỗi màn hình là một file HTML riêng**. Không dùng SPA hash-route.
- Các file HTML link qua lại bằng `<a href="...html">`, form submit demo, button click, modal/drawer.
- Dùng chung `styles.css` và `app.js`. Có thể thêm `mock-data.js` nếu cần tách mock data cho sạch.
- Mock data phải đủ để bấm qua toàn bộ luồng mà không cần backend.
- Dùng `localStorage` để giữ session/demo state giữa các file HTML: login, consent, unlocked profile, active tracking, tutor QR active, admin role...
- Vẫn tạo sẵn `apiBase = "http://localhost:3000/api/v1"` và các function API stub để sau này nối backend.
- Mọi nút chính phải bấm được: chuyển file HTML, mở modal/drawer, đổi trạng thái demo, hiện toast, cập nhật mock list/table.
- UI copy tiếng Việt.
- Cards border-radius tối đa 8px. Tránh UI toàn gradient tím/xanh; tránh trang marketing chung chung.
- Không được để màn hình trắng hoặc nút chết.

Yêu cầu chất lượng UI để tránh nhìn như AI mockup:

- Không dùng layout "AI template" lặp lại: không hero gradient tím/xanh, không các card giống nhau xếp lưới vô hồn, không blob/orb trang trí, không icon emoji làm icon chính.
- Thiết kế phải giống sản phẩm được designer làm: spacing có hệ thống, hierarchy rõ, typography ổn, hover/focus/active state đầy đủ, empty/loading/error state có chủ đích.
- Dùng màu tiết chế: nền sáng, text tương phản tốt, 1 màu brand chính, 1 màu accent, status colors riêng. Không phủ toàn bộ UI bằng một hue.
- Dùng icon dạng line icon/simple symbol nhất quán. Nếu không có thư viện icon thì dùng text label rõ hoặc SVG nhỏ tự viết, không dùng emoji rải rác.
- Button phải có phân cấp rõ: primary, secondary, ghost, danger. CTA chính nổi bật, CTA phụ không tranh chấp.
- Bảng/form phải nhìn như app thật: label rõ, helper text, validation inline, disabled/loading state, confirmation cho action nhạy cảm.
- Không làm mọi section thành card. Chỉ dùng card cho item lặp lại, panel công cụ, modal/drawer. Section lớn nên là layout/band rõ ràng.
- Responsive phải được thiết kế thật: desktop, tablet, mobile. Mobile không chỉ co nhỏ desktop; cần bottom nav/drawer/stacked cards hợp lý.
- Mỗi app phải có cá tính riêng:
  - `tutor-market`: polished consumer marketplace, giống booking/travel search nhưng chuyển ngữ sang giáo dục.
  - `tutor-app`: workspace thực dụng cho gia sư, tập trung việc cần làm hôm nay.
  - `tutor-admin`: console vận hành dense, table-first, ít trang trí.
- Trước khi hoàn tất, tự kiểm tra bằng mắt: nếu nhìn giống template AI/generic SaaS, hãy chỉnh lại spacing, màu, ảnh, typography và component composition.

## Prompt 1: `tutor-market`

```text
Create a complete static multi-page prototype for `tutor-market` using plain HTML/CSS/vanilla JS only. No framework. It must run by opening `index.html`.

Important architecture:
- This is NOT a single-page app.
- Each screen must be a separate HTML file.
- All screens share `styles.css`, `app.js`, and optionally `mock-data.js`.
- Navigation between screens uses normal links like `search.html`, `tutor-detail.html?id=tutor-1`, `dashboard.html?studentId=stu-1`.
- Use localStorage to persist demo state between pages: loggedIn, consentAccepted, unlockedTutorIds, trackingActiveStudentIds, subscriptions, trials, notificationsRead.

Product:
- Parent marketplace app for Kim Thanh Tutor.
- Users can search tutors, view locked/unlocked details, request trials, unlock profiles, buy VIP/tracking, manage students, view learning dashboard, review classes, read notifications.
- First screen must look like Agoda/Traveloka/Booking.com search marketplace, but for tutors.

Design quality bar:
- Aim for a premium consumer marketplace feel, not a generic education landing page.
- Use a real-photo-like hero background with students/tutor learning, with subtle dark overlay only for readability.
- Search box should feel like a booking widget: grouped fields, clear labels, strong search button, compact but polished controls.
- Results should feel like a real marketplace/listing product: price emphasis, rating badge, trust signals, location/mode chips, comparison-friendly layout.
- Add small believable details: "đã xác minh", "phản hồi nhanh", "phù hợp lớp 6-9", "học thử", "VietQR an toàn".
- Results must appear immediately below the hero. Do not insert generic "Why choose us" marketing sections before results.
- Avoid fake decorative gradients. Use color for hierarchy/status, not as the main visual gimmick.

Required files:
- `index.html`: redirect/landing shell that immediately links or forwards to `search.html`; also works if opened directly.
- `search.html`: booking-style search home + tutor results.
- `tutor-detail.html`: tutor detail with locked/unlocked paywall.
- `login.html`: email + password + Google demo.
- `consent.html`: terms/privacy consent.
- `parent-profile.html`: parent profile form.
- `students.html`: student list/add/edit.
- `trials.html`: parent trial requests.
- `classes.html`: parent class list.
- `dashboard.html`: student learning dashboard with tracking paywall.
- `subscriptions.html`: packages and subscription list.
- `checkout.html`: reusable checkout/payment polling demo.
- `review.html`: review create/edit.
- `notifications.html`: notification center.
- `settings.html`: API base/session/demo settings.
- `styles.css`: all responsive styling.
- `app.js`: shared JS utilities, mock data, state, click handlers, API stubs.
- Optional `mock-data.js`: arrays of tutors/students/classes/trials/payments/notifications.

Global layout on every page:
- Header: Kim Thanh Tutor logo linking to `search.html`, nav links to Search, Students, Classes, Subscriptions, Notifications, Account.
- Mobile bottom nav: Search, Students, Classes, Packages, Account.
- Toast root and modal root.
- If not logged in, show Login button. If logged in, show parent/profile menu.

Screen details:

1. `search.html`
- First viewport: large search-led hero with education/tutoring photo-like background, designer-level spacing, clear hierarchy, and real listing results visible below.
- Large booking-style search box:
  - subject
  - grade_level
  - teaching_mode
  - province/location
  - fee_max
  - search button
- Below hero:
  - quick filter chips
  - sort select: rating/newest/fee_asc
  - desktop filter sidebar and mobile filter drawer
  - tutor result cards
- Tutor cards show avatar, name, rating, school, region, subjects, grade levels, teaching modes, fee range, short bio.
- Tutor cards must not all look identical: vary visual emphasis using rating, availability, verified badge, response time, price, and subject chips.
- CTA buttons:
  - `Xem hồ sơ` links to `tutor-detail.html?id=tutor-1`
  - `Gửi yêu cầu học thử` opens trial request modal
- Search/filter must update cards from mock data.
- Fee min/max validation must show inline error.

2. `tutor-detail.html`
- Read tutor id from URL query `?id=tutor-1`.
- Show tutor header, rating, school, fee, subjects, mode, overview.
- Locked state:
  - Hide full bio/video/reviews.
  - Show paywall block.
  - Buttons:
    - `Mở khóa hồ sơ này` links to `checkout.html?product=single_unlock&tutorId=tutor-1`
    - `Mua VIP phụ huynh` links to `checkout.html?product=parent_vip`
    - `Gửi yêu cầu học thử` opens trial modal
- Unlocked state:
  - If tutor id exists in localStorage unlocked list, show full bio, video placeholder, reviews.
- Back link to `search.html`.

3. `login.html`
- Google demo button (server-side redirect), Facebook demo button.
- Email + password register form and login form; verify-email link demo.
- On successful demo login, save session to localStorage and redirect to `consent.html` if consent not accepted, otherwise `parent-profile.html`.

4. `consent.html`
- Terms/privacy cards with version/checksum.
- Scrollable consent text.
- Checkbox "Tôi đã đọc và đồng ý".
- Submit saves `consentAccepted=true` and goes to `parent-profile.html`.

5. `parent-profile.html`
- Parent profile form.
- Save button stores profile to localStorage and shows toast.
- Link to `students.html`.

6. `students.html`
- List student cards from mock/localStorage.
- Add student modal: name, grade, learning_goals.
- Edit/delete actions update localStorage.
- Dashboard button links to `dashboard.html?studentId=stu-1`.

7. `trials.html`
- List parent trial requests from mock/localStorage.
- Tabs/status filters: pending, accepted, declined, cancelled.
- Trial cards show tutor, subject, grade, schedule, status.

8. `classes.html`
- List classes from mock data.
- Each class card links to:
  - `dashboard.html?studentId=...`
  - `review.html?classId=...`

9. `dashboard.html`
- Read `studentId`.
- Always show overview and latest lesson.
- If tracking is not active for this student, show paywall CTA to `checkout.html?product=parent_tracking&studentId=...`.
- If tracking active, show lesson timeline, homework, absorption chart, tutor notes.

10. `subscriptions.html`
- Product cards:
  - single unlock
  - parent VIP
  - parent tracking
- Existing subscriptions table from mock/localStorage.
- Buttons link to `checkout.html`.

11. `checkout.html`
- Read query params: product, tutorId, studentId.
- Show amount, QR placeholder, transfer content, payment id/status.
- Button `Tôi đã thanh toán`:
  - single_unlock adds tutor id to unlockedTutorIds and links back to tutor detail.
  - parent_vip adds active subscription.
  - parent_tracking adds student id to trackingActiveStudentIds and links to dashboard.

12. `review.html`
- Read classId.
- Show class info, current review if any.
- Rating/comment form.
- Save stores review in localStorage and shows toast.

13. `notifications.html`
- Notification list.
- Mark read updates localStorage and UI.

14. `settings.html`
- API base input.
- Session/localStorage preview.
- Clear demo state button.

API stubs in `app.js`:
- `apiRequest(path, options)`
- `searchTutors(query)`, `getTutorPublic(id)`
- `register`, `verifyEmail`, `login`, `loginGoogle`, `loginFacebook`, `getMe`, `submitConsent`
- `getParentProfile`, `saveParentProfile`
- `listStudents`, `saveStudent`, `deleteStudent`
- `createTrial`, `listMyTrials`
- `checkout`, `getPayment`, `listSubscriptions`
- `listClasses`, `getStudentOverview`, `getStudentDetail`
- `getClassReview`, `saveReview`
- `listNotifications`, `markNotificationRead`

Mock data required:
- At least 6 tutors with different subjects, grades, regions, fees, ratings.
- At least 2 students.
- At least 3 trial requests.
- At least 3 classes.
- At least 3 lesson logs.
- At least 3 notifications.
- Product pricing for single_unlock, parent_vip, parent_tracking.

Acceptance checklist:
- Opening `index.html` leads to a beautiful `search.html`.
- Every HTML file above exists.
- Every page has shared header/nav and working links.
- User can click from search → tutor detail → checkout → paid → unlocked detail.
- User can click from students → dashboard → tracking checkout → paid → unlocked timeline.
- User can add/edit student, create trial, save review, mark notification read.
- Mobile layout works with bottom nav.
```

## Prompt 2: `tutor-app`

```text
Create a complete static multi-page prototype for `tutor-app` using plain HTML/CSS/vanilla JS only. No framework. It must run by opening `index.html`.

Important architecture:
- This is NOT a single-page app.
- Each screen must be a separate HTML file.
- All screens share `styles.css`, `app.js`, and optionally `mock-data.js`.
- Navigation uses normal file links like `dashboard.html`, `profile.html`, `class-detail.html?id=class-1`.
- Use localStorage to persist demo state: loggedIn, consentAccepted, tutorProfile, profileStatus, availabilitySlots, trials, classes, lessonLogs, qrActive, payoutAccounts, qrRecords, notificationsRead.

Product:
- Tutor workspace for Kim Thanh Tutor.
- Tutors create/publish profile, manage availability, accept trials, manage classes, write lesson logs, buy QR package, manage payout accounts, generate tuition QR, report reviews, read notifications.

Design quality bar:
- This should feel like a real productivity/workspace app, not a consumer landing page.
- First screen is a work queue: "việc cần làm hôm nay", pending trials, lesson logs due, QR/payment status.
- Use compact cards, timelines, status badges, sidebars, drawers and clear form sections.
- Avoid hero banners and decorative artwork. Tutors need speed and clarity.
- Make forms feel serious: grouped sections, progress/completeness checklist, inline validation, sticky save/publish actions where useful.
- Mobile should feel like a practical phone app: bottom nav, large touch targets, concise cards.

Required files:
- `index.html`: opens/links to `dashboard.html`.
- `dashboard.html`: tutor work queue.
- `login.html`: email + password auth demo.
- `consent.html`: consent demo.
- `profile.html`: tutor profile editor and publish flow.
- `availability.html`: weekly availability grid.
- `trials.html`: trial inbox.
- `classes.html`: class list.
- `class-detail.html`: class detail and transition actions.
- `lesson-logs.html`: lesson log timeline and composer.
- `billing.html`: tutor QR subscription checkout/status.
- `payout-accounts.html`: payout accounts.
- `qr-records.html`: create/list tuition QR records.
- `review.html`: view/report review.
- `notifications.html`: notification center.
- `settings.html`: API/session/demo settings.
- `styles.css`, `app.js`, optional `mock-data.js`.

Global layout:
- Desktop sidebar on every page: Dashboard, Hồ sơ, Lịch rảnh, Học thử, Lớp học, Gói QR, Tài khoản nhận tiền, QR học phí, Thông báo, Cài đặt.
- Mobile bottom nav: Dashboard, Hồ sơ, Lớp, QR, Thêm.
- Topbar with tutor identity, profile status, notification bell, quick action "Ghi sổ đầu bài".

Screen details:

1. `dashboard.html`
- Summary cards: profile status/completeness, pending trials, active classes, QR package status.
- Work queue:
  - pending trial requests
  - classes needing lesson logs
  - QR records pending collection
- Quick action buttons link to profile, trials, lesson logs, QR records.

2. `login.html` and `consent.html`
- Login has email + password form and Google demo.
- Consent saves localStorage and redirects to dashboard.

3. `profile.html`
- Form sections:
  - identity/avatar/video placeholder
  - subjects
  - grade levels
  - teaching modes
  - region/offline areas
  - education/school/student year
  - exam score/GPA
  - fee min/max
  - bio
- Marketplace preview card.
- Completeness checklist.
- Upload media button shows modal with media_id/upload_url/expires_at.
- Publish button changes profileStatus to published and persists in localStorage.

4. `availability.html`
- Weekly grid Monday-Sunday.
- Add slot modal: day, start_time, end_time, type, note.
- Delete slot action.
- Saves slots to localStorage.

5. `trials.html`
- Tabs/status filters.
- Cards show parent/student summary, subject, grade, schedule, status.
- Accept button creates class in localStorage and goes to `classes.html`.
- Decline opens reason modal and changes status.

6. `classes.html`
- List classes grouped by status.
- Each class links to `class-detail.html?id=class-1`.
- Buttons link to `lesson-logs.html?classId=class-1` and `qr-records.html?classId=class-1`.

7. `class-detail.html`
- Read class id.
- Show class info, status timeline, transition buttons.
- Transition action updates class status in localStorage.

8. `lesson-logs.html`
- Read classId.
- Timeline of lesson logs.
- Composer fields: lesson_at, subject, content, homework, absorption_level, tutor_note.
- Save adds log to localStorage.
- Edit action opens modal.

9. `billing.html`
- Show tutor_qr product and subscription status.
- Checkout QR placeholder.
- Button "Tôi đã thanh toán" sets qrActive=true.

10. `payout-accounts.html`
- List masked payout accounts.
- Add account form: bank_code, account_number, account_holder, is_default.
- Save masks account number and stores in localStorage.

11. `qr-records.html`
- Create QR record for selected class, amount, description, payout_account_id.
- If qrActive=false, show paywall CTA to billing.
- If active, show QR placeholder, payment link, transfer content.
- "Đã thu" marks collected.
- Show note: platform does not verify bank receipt.

12. `review.html`
- Show review from parent and report button.
- Report opens reason modal and stores report status.

13. `notifications.html`
- List notifications and mark read.

14. `settings.html`
- API base input, session preview, clear state/logout.

API stubs in `app.js`:
- `apiRequest`
- `register`, `verifyEmail`, `login`, `loginGoogle`, `loginFacebook`, `getMe`, `submitConsent`
- `getTutorProfile`, `saveTutorProfile`, `publishTutorProfile`, `createUploadUrl`
- `listAvailabilities`, `createAvailability`, `deleteAvailability`
- `listTutorTrials`, `acceptTrial`, `declineTrial`
- `listClasses`, `transitionClass`
- `listLessonLogs`, `createLessonLog`, `updateLessonLog`
- `listPayoutAccounts`, `createPayoutAccount`
- `checkoutTutorQr`, `getPayment`, `listSubscriptions`
- `createQrRecord`, `listQrRecords`, `markQrCollected`
- `getClassReview`, `reportReview`
- `listNotifications`, `markNotificationRead`

Mock data required:
- Tutor profile.
- 3 availability slots.
- 3 trial requests.
- 3 classes.
- 4 lesson logs.
- 2 payout accounts.
- 2 QR records.
- 3 notifications.

Acceptance checklist:
- Opening `index.html` reaches `dashboard.html`.
- Every HTML file above exists and is linked from sidebar/buttons.
- Profile publish, trial accept/decline, class transition, lesson log save, QR package activation, QR creation, mark collected all work with localStorage.
- No blank screens and no dead primary buttons.
```

## Prompt 3: `tutor-admin`

```text
Create a complete static multi-page prototype for `tutor-admin` using plain HTML/CSS/vanilla JS only. No framework. It must run by opening `index.html`.

Important architecture:
- This is NOT a single-page app.
- Each screen must be a separate HTML file.
- All screens share `styles.css`, `app.js`, and optionally `mock-data.js`.
- Navigation uses normal file links like `overview.html`, `users.html`, `user-detail.html?id=user-1`.
- Use localStorage to persist admin demo state: adminLoggedIn, users, paidFeatureOverrides, moderation actions, refunds, pricing, platformPaymentAccount, notificationsRead.

Product:
- Internal admin console for Kim Thanh Tutor.
- Admin monitors metrics, manages users, moderates tutors/media/reviews, inspects payments/refunds/logs, configures VietQR account and pricing, overrides paid features.

Design quality bar:
- This should look like an internal operations console designed for daily use, not a flashy dashboard.
- Table-first, dense, scan-friendly, with good filters and drawers.
- Use neutral backgrounds, thin borders, compact rows, clear status badges.
- Avoid oversized cards, marketing copy, decorative images, and gradient hero sections.
- Every sensitive action should look deliberate: confirmation modal, reason field, audit note.
- Mobile can be usable, but desktop density is more important for admin.

Required files:
- `index.html`: opens/links to `overview.html`.
- `overview.html`: metrics dashboard.
- `login.html`: admin login/session demo.
- `users.html`: user table.
- `user-detail.html`: user detail.
- `paid-features.html`: user paid feature override.
- `moderation.html`: moderation queue.
- `payments.html`: payment table/search.
- `refunds.html`: refund form.
- `logs.html`: audit/webhook/outbox logs.
- `platform-payment.html`: platform VietQR account setup.
- `pricing.html`: product pricing setup.
- `notifications.html`: admin notifications.
- `settings.html`: API/session/demo settings.
- `styles.css`, `app.js`, optional `mock-data.js`.

Global layout:
- Desktop left sidebar on every page: Overview, Users, Moderation, Payments, Refunds, Logs, Platform Payment, Pricing, Notifications, Settings.
- Topbar: admin identity, API base/environment, refresh button.
- Table-first UI, compact filters, badges, confirmation modals.

Screen details:

1. `overview.html`
- Metric cards: users, registrations, moderation, payments, paid features.
- CSS bar chart for registrations.
- CTA buttons link to moderation, payments, logs.

2. `login.html`
- Admin email + password demo login.
- Save adminLoggedIn=true.
- If not logged in, pages show forbidden state with link to login.

3. `users.html`
- Filters: role, status, q, created_from, created_to.
- Table columns: user id, roles, status, masked email/phone, profile summary, paid feature summary, actions.
- Actions link to `user-detail.html?id=user-1` and `paid-features.html?userId=user-1`.

4. `user-detail.html`
- Read user id.
- Show user, profiles, subscriptions, payments summary, feature overrides.
- Suspend/activate opens confirmation modal with reason and updates localStorage.

5. `paid-features.html`
- Read userId.
- Rows: single_unlock, parent_vip, parent_tracking, tutor_qr.
- Show entitlement state and override state.
- Edit action opens modal: enabled toggle, reason, expires_at.
- Save persists override.

6. `moderation.html`
- Tabs: tutors, media, reviews.
- Each tab table has preview/status/actions.
- Approve/reject/hide/publish actions require confirmation modal and update row status.

7. `payments.html`
- Filters: status, product_type, payer_user_id.
- Table columns: payment id, payer, product, amount, status, provider_reference, actions.
- Detail action opens safe modal.
- Refund action links to `refunds.html?paymentId=pay-1`.

8. `refunds.html`
- Form: payment_id, amount optional, reason required.
- Confirmation modal.
- Save creates refund in localStorage and shows success state.

9. `logs.html`
- Segmented filter: audit, webhook, outbox.
- Filters: status, actor_user_id, entity_type, entity_id.
- Table shows safe preview only, no raw payload/IP/secret.

10. `platform-payment.html`
- Current masked VietQR account card.
- Edit form: bank_code, account_number, account_holder, is_active.
- Save confirmation persists config.

11. `pricing.html`
- Product rows: single_unlock, parent_vip, parent_tracking, tutor_qr.
- Edit modal: amount, period_days, is_enabled, reason.
- Save persists pricing.

12. `notifications.html`
- List notifications, mark read.

13. `settings.html`
- API base input, admin/session preview, clear demo state.

API stubs in `app.js`:
- `apiRequest`, `adminLogin`, `getMe`
- `getAdminOverview`
- `listAdminUsers`, `getAdminUser`, `updateUserStatus`
- `listUserPaidFeatures`, `updateUserPaidFeature`
- `getModerationQueue`, `setTutorStatus`, `moderateReview`, `moderateMedia`
- `listAdminPayments`, `createRefund`
- `listAuditLogs`, `listSystemLogs`
- `getPlatformPaymentAccount`, `updatePlatformPaymentAccount`
- `listPricing`, `updatePricing`
- `listNotifications`, `markNotificationRead`

Mock data required:
- 5 users with roles parent/tutor/admin and different statuses.
- 5 payments with different product/status.
- Moderation queues for tutors/media/reviews.
- Audit/webhook/outbox logs.
- Pricing for all 4 product types.
- Platform payment account.
- 3 notifications.

Acceptance checklist:
- Opening `index.html` reaches `overview.html`.
- Every HTML file above exists and is linked from sidebar/buttons.
- User suspend/activate, paid feature override, moderation action, refund, platform payment save, pricing edit all work with confirmation modal and localStorage.
- No blank screens and no dead primary buttons.
```
