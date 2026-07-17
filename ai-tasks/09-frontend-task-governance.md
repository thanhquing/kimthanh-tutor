# Quy Ước Triển Khai Frontend Từ Mock UI

Tài liệu này là điểm vào cho việc dựng `tutor-app`, `tutor-market` và `tutor-admin` từ `kimthanh-tutor-mock/public`. Mock là nguồn tham chiếu về bố cục và ý đồ tương tác, không phải nguồn chân lý về business rule hay API contract.

## 1. Thứ tự nguồn chân lý

Khi có mâu thuẫn, áp dụng theo thứ tự:

1. Code API đang chạy và Prisma schema.
2. `ai-docs`, đặc biệt `01`, `03`, `09`, `10`, `12`–`15`.
3. `ai-tasks/05-api-endpoints.md` và flow cURL trong `07`.
4. Các task frontend `10`–`12`.
5. HTML/CSS/JS trong `kimthanh-tutor-mock/public`.

Không copy business state, giá, request body hoặc quyền truy cập từ mock khi chúng khác API thật. Mọi khác biệt đã biết được ghi trong `13-mock-ui-ux-audit.md`.

## 2. Cách AI mới chọn đúng task

`14-active-work.md` là con trỏ điều phối duy nhất. AI mới không tự chọn giữa `TA-*`, `TM-*` và `AD-*`.

Quy trình bắt buộc:

1. Đọc `Current task` trong `14-active-work.md`.
2. Mở task cùng ID trong file app được trỏ tới và kiểm tra mọi dependency đã `DONE`.
3. Nếu task đang `TODO`, ghi `INPROGRESS`, `Owner`, `Started` ở cả task list và `14-active-work.md` trước khi sửa code. Không tạo commit claim riêng; thay đổi trạng thái này đi cùng commit full-scope của task.
4. Nếu task đã `INPROGRESS` bởi owner khác, dừng và báo đang có người làm; không nhận task trong queue.
5. Nếu dependency chưa `DONE` hoặc có blocker cần quyết định sản phẩm, không tự bỏ qua sang task khác; ghi blocker và xin điều phối.
6. Khi hoàn tất, đổi task sang `DONE`, ghi evidence, cập nhật `Last completed task`, rồi chuyển `Current task` sang dòng kế tiếp đủ dependency trong cùng commit task.

Fallback chỉ dùng khi `Current task` bị trống hoặc trỏ tới task đã `DONE`: chọn task `TODO` đầu tiên trong bảng `Global queue` có mọi dependency `DONE`, cập nhật con trỏ rồi mới làm. Các task hậu MVP cần explicit approval, dù đã tới lượt.

## 3. Trạng thái task

Mỗi task chỉ được dùng đúng một trong ba trạng thái:

- `TODO`: chưa bắt đầu hoặc chưa có commit triển khai.
- `INPROGRESS`: đã có người/AI nhận và đang sửa code. Khi đổi sang trạng thái này phải thêm `Owner`, `Started` và tên branch/working note nếu có.
- `DONE`: đã merge/giữ commit hoàn chỉnh, mọi tiêu chí nghiệm thu và verification trong task đều pass. Phải thêm ngày hoàn tất và bằng chứng test.

Không dùng `BLOCKED` làm trạng thái. Nếu bị chặn, task vẫn là `TODO` hoặc `INPROGRESS` và ghi rõ `Blocker` bên dưới; các AI khác vẫn đọc được nguyên nhân mà không phá schema trạng thái.

Mẫu cập nhật:

```md
Trạng thái: INPROGRESS
Owner: codex/<tên>
Started: YYYY-MM-DD
Commit: —
Blocker: —
```

Khi hoàn tất:

```md
Trạng thái: DONE
Owner: codex/<tên>
Completed: YYYY-MM-DD
Commit lookup: `git log --oneline --grep='<TASK-ID>' -1`
Evidence: pnpm ...; verify-flow-... pass; ảnh/route đã kiểm tra
```

Không ghi SHA của chính commit vào nội dung commit đó vì SHA sẽ thay đổi khi amend. Commit subject bắt buộc chứa task ID; AI/reviewer tra SHA bằng lệnh `git log --grep` ở trên.

## 4. Một task là một commit full-scope

Một task chỉ được đánh dấu `DONE` khi cùng một commit logic đã bao phủ đầy đủ:

- UI responsive dựa trên đúng màn mock được liệt kê trong task, có loading/empty/error/forbidden/expired state.
- Điều hướng, auth gate, consent gate và capability gate đúng vai trò.
- Tích hợp API thật; request/response typed từ `@kimthanh-tutor/contracts` hoặc bổ sung contract dùng chung trong cùng task.
- Nếu API thiếu/sai để hoàn tất hành trình: refactor `tutor-api`, DTO/schema/migration/service/controller và tài liệu liên quan trong cùng task.
- Unit test cho state/mapper/validation; component/integration test cho hành vi chính; API service test nếu backend đổi.
- cURL hoặc script `verify-flow-*` cho happy path và ít nhất một lỗi quyền/validation liên quan.
- `pnpm lint`, `pnpm test`, `pnpm build` của package bị chạm đều pass.
- Không chứa secret, raw PII, token hay dữ liệu trẻ em trong log/snapshot.
- Cập nhật **`15-perf-security-checklist.md`**: đưa mọi hạng mục performance/bảo mật (theo OWASP/Web Vitals/NĐ 13/`ai-docs 12`–`14`) mà scope task chạm tới sang 🟢 kèm evidence ở cột app tương ứng; task còn hạng mục liên quan ở 🟡/⚪ **không được** đánh `DONE`. Task đã `DONE` trước khi checklist được thêm ở trạng thái "chưa xác nhận" cho tới khi chủ dự án chốt cách xử lý.
- Cập nhật task status và tài liệu contract/flow nếu hành vi thay đổi.

Tên commit đề xuất: `feat(<app>): <TASK-ID> <phạm vi ngắn>`; fix hậu kiểm: `fix(<app>): <TASK-ID> ...` nhưng vẫn squash thành một commit task trước khi đánh dấu `DONE`.

## 5. Kiến trúc frontend đề xuất

Đây là baseline để ba app không tự phát triển ba kiểu khác nhau. Task scaffold đầu tiên của mỗi app có quyền điều chỉnh nếu ghi rõ lý do và cập nhật tài liệu này trước khi code tiếp.

- TypeScript strict và React. `tutor-app`/`tutor-admin` dùng SPA (Vite + React Router). `tutor-market` dùng kiến trúc hybrid trên framework hỗ trợ SSR/SSG (đề xuất Next.js App Router): route public được server-render/static để SEO/share; route cần login chạy như client-side app và không index.
- TanStack Query cho server state; form library + schema validation có typed mapper riêng.
- Vitest + Testing Library + MSW cho unit/component/contract test; Playwright cho smoke/E2E khi scaffold nền đã ổn định.
- CSS tokens và component primitives nằm trong từng app trước; chỉ tách package UI dùng chung khi đã có ít nhất hai consumer thật sự giống nhau.
- `@kimthanh-tutor/contracts` là nguồn enum/type API. Không định nghĩa lại `ClassStatus`, `ProductType`, `SubscriptionStatus` trong app.
- Một API client thống nhất: base URL từ build-time env; Bearer token; refresh rotation có single-flight; `Idempotency-Key`; parse error chuẩn; abort request; tuyệt đối không có công tắc mock/API base trong production UI.
- Tiền lấy từ response checkout/pricing, không nhận `amount` từ URL hoặc state phía client.
- UTC từ API, format `Asia/Ho_Chi_Minh` ở view; tiền là integer VND.
- Auth parent/tutor giữ access/refresh trong memory token store theo scaffold hiện tại, refresh single-flight và tuyệt đối không dùng browser storage/log/snapshot; task auth phải giữ lại/đánh giá threat model này. Riêng `tutor-admin` đã chốt access token ở RAM + refresh cookie HttpOnly `SameSite=Strict`, client retry ngắn khi refresh gặp `409` do multi-tab và không logout server khi chỉ gặp 5xx/network tạm thời.
- Public search/tutor profile phải có HTML server-rendered/cached, canonical URL ổn định, metadata title/description, Open Graph, sitemap và JSON-LD phù hợp. Metadata chỉ dùng dữ liệu preview public/approved; không đưa nội dung paywall, contact, PII, media pending/rejected hoặc rating đang bị khóa vào source HTML.
- Route login-only (`account`, `students`, `classes`, `dashboard`, `billing`, `checkout`, notifications...) dùng client navigation/query cache như SPA, đặt `noindex,nofollow`, không render dữ liệu protected vào HTML public và không xuất hiện trong sitemap.

## 6. Route và quyền sở hữu app

| App | Người dùng | Route gốc đề xuất | Quyền chính |
| --- | --- | --- | --- |
| `tutor-market` | guest, parent | `/`, `/tutors/:id`, `/students/*`, `/classes`, `/billing/*` | guest được search/detail preview/trial lead; parent mới xem dữ liệu của mình |
| `tutor-app` | tutor | `/dashboard`, `/profile`, `/trials`, `/classes/*`, `/billing`, `/qr` | bắt buộc authenticated + consent + role tutor, ownership fail closed |
| `tutor-admin` | admin | `/overview`, `/users/*`, `/moderation`, `/payments`, `/logs` | bắt buộc authenticated + role admin; mutation nhạy cảm có reason + audit |

Các file redirect alias của mock (`search.html`, `tutor-detail.html`, `parent-profile.html`, `subscriptions.html`) không phải màn độc lập và không tạo task riêng.

## 7. Dependency và thứ tự thực hiện

```text
Contracts/API consistency audit
  ├─ tutor-market scaffold → search/paywall → auth/consent → trial → parent/classes/dashboard → billing/review
  ├─ tutor-app scaffold    → auth/consent → profile/schedule → trial/classes/logs → payout/billing/QR/review
  └─ tutor-admin scaffold  → auth/RBAC → overview/users → moderation/payments/logs/config

Cross-app E2E cuối:
guest trial → tutor accept → parent activation/consent → class active
→ tutor lesson log → parent tracking dashboard → class complete/review
→ tutor report → admin moderation
```

Không bắt đầu task feature khi task scaffold của app chưa `DONE`. Những task có dependency nghiệp vụ phải đợi dependency được ghi trong từng file.

## 8. Quy tắc review cho AI kế tiếp

Trước khi nhận task:

1. Đọc `CLAUDE.md`, `14-active-work.md`, file task app, task audit liên quan và `04-open-questions.md`.
2. Kiểm tra `git status`; không ghi đè thay đổi của người khác.
3. Chỉ nhận `Current task`; chuyển duy nhất task đó sang `INPROGRESS` trong working tree.
4. Chạy baseline test trước khi sửa và ghi lại failure có sẵn.
5. Không tiện tay triển khai task kế tiếp trong cùng commit.

Khi review task đã làm, reviewer kiểm tra lại request/response trên network, quyền với user khác, responsive keyboard/focus, lỗi API, refresh trang sâu, token expiry và script cURL; không chỉ so ảnh với mock.

## 9. Các quyết định sản phẩm chưa chốt

Các task vẫn có thể triển khai UI theo cấu hình động, nhưng không hard-code câu trả lời cho các mục trong `04-open-questions.md`, đặc biệt:

- Giá và kỳ hạn sản phẩm; refund; trả thiếu/thừa/sai nội dung.
- Thời điểm chia sẻ thông tin liên hệ.
- Chính sách moderation video/review.
- Auto-renew gói QR.
- Legal document production và yêu cầu re-consent.

Giá fallback hiện có ở backend chỉ dành cho vận hành kỹ thuật. UI phải hiển thị giá do backend trả về và trạng thái product enabled/disabled.
