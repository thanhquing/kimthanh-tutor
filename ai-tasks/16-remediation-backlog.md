# Remediation Backlog — Nợ Kỹ Thuật & Khắc Phục Quy Trình

Danh sách tập trung các vấn đề phát hiện khi kiểm thử thực tế trên browser (2026-07-18), cần fix cho **task cũ** (đã `DONE`) lẫn **task hiện tại**. File này là nguồn theo dõi việc khắc phục; khi một mục xong, đánh `DONE` kèm commit/evidence và, nếu là thay đổi hành vi, cập nhật doc tương ứng.

Thứ tự ưu tiên: `P0` chặn/đang hỏng thật → `P1` gate quy trình → `P2` UX/kiến trúc cần chốt.

## 0. Nguyên nhân gốc (systemic)

Các task frontend được chứng nhận `DONE` bằng **unit/component test (fetch mock) + script cURL**, **chưa từng** chạy màn trên **browser thật** với API thật. Hệ quả: một bug phá **toàn bộ** lời gọi API vẫn lọt qua 93 unit test xanh. Quy trình đã sửa ở commit `docs(process): bắt buộc E2E smoke browser thật` — backlog này là phần dọn nợ đã tích lũy trước đó.

## 1. Bảng vấn đề

| ID | Ưu tiên | Vấn đề | Phạm vi / task chạm | Trạng thái |
| --- | --- | --- | --- | --- |
| R-01 | P0 | `ApiClient` lưu native `fetch` vào field rồi gọi `this.fetcher(...)` → `this = ApiClient` → `TypeError: Illegal invocation`, **hỏng mọi API call trên browser**, không có entry Network | `tutor-app` (TA-00 client, dùng bởi TA-01/02/03); `tutor-market` (TM-00 client) | ✅ **DONE** — tutor-app + tutor-market fix `fetch.bind(globalThis)` + regression test; tutor-admin đúng sẵn (chuẩn tham chiếu) |
| R-02 | P1 | Không có E2E smoke browser thật cho bất kỳ màn FE nào; task `DONE` chỉ bằng unit test + cURL | TA-00, TA-01, TA-02, TA-03, TM-00, AD-00 | 🟡 tutor-app: smoke TA-02 (profile) + TA-03 (availability) ✅; **tutor-market/tutor-admin còn OPEN** |
| R-03 | P1 | Chưa có harness Playwright trong 3 app (chạy headless với API dockerized) | `tutor-app`, `tutor-market`, `tutor-admin` | 🟡 tutor-app: ✅ harness (`playwright.config.ts` + `e2e/`, Chrome hệ thống, seed API); tutor-market/tutor-admin còn OPEN |
| R-04 | P1 | Thiếu test ranh giới bằng implementation thật cho `ApiClient` (bắt lỗi unbound `fetch`) | tutor-app ✅ + tutor-market ✅ regression; tutor-admin đúng sẵn nhưng chưa có test khẳng định | 🟡 gần xong (thiếu test khẳng định cho tutor-admin) |
| R-05 | P2 | Chưa chốt chiến lược phiên đăng nhập: memory-only (reload = login lại) vs refresh cookie HttpOnly cho tutor/parent | `tutor-app`, `tutor-market`, `tutor-api` auth | ⚪ OPEN — quyết định sản phẩm (`04-open-questions.md`) |
| R-06 | P2 | Chạy dev local dính CORS + IPv4/IPv6 (Vite bind `::1`, API IPv4, CORS thiếu `localhost`) | tutor-app: ✅ dev proxy; tutor-market/tutor-admin: cần cùng ergonomics + README | 🟡 một phần |

## 2. Chi tiết & cách fix

### R-01 — Bug binding `fetch` (P0)
- Chuẩn đúng: `tutor-admin/src/lib/api/client.ts:43` bọc `((input, init) => globalThis.fetch(input, init))`.
- Fix `tutor-market/src/lib/api/client.ts:26`: đổi `?? fetch` → `?? fetch.bind(globalThis)` (hoặc wrapper như admin) + thêm regression test mô phỏng ràng buộc `this` của native fetch.
- `tutor-app` đã fix (`client.ts` + `client.test.ts`), chờ đóng cùng foundational fix.

### R-02 / R-03 — Tầng E2E smoke còn thiếu (P1)
- Dựng harness Playwright cho từng app: khởi động API dockerized + dev server (proxy `/api`), đăng nhập OTP dev (`272727`), chạy happy-path mỗi màn đã build, assert Network `2xx` + DOM.
- Smoke hồi tố tối thiểu: `tutor-app` login → profile (TA-02), login → availability (TA-03); `tutor-admin` login → overview; `tutor-market` search public → detail.
- Sau khi có smoke, các task `DONE` cũ được **re-certify**; tới lúc đó ghi chú "browser-unverified" bên cạnh evidence của chúng.

### R-04 — Test ranh giới thật (P1)
- Mỗi app có ≥1 test `ApiClient` chạy qua `fetch` thật/bound (đã có mẫu ở `tutor-app/src/lib/api/client.test.ts`).

### R-05 — Chiến lược phiên (P2)
- Chốt trong `04-open-questions.md`. Nếu chọn HttpOnly cookie cho tutor/parent → mở task refactor `tutor-api` auth (set/clear cookie, `SameSite`/CSRF, rotation) + FE bỏ nhận refresh trong body, đồng bộ với mô hình `tutor-admin`.

### R-06 — Ergonomics dev (P2)
- Áp dev proxy `/api` cho `tutor-market`/`tutor-admin` như `tutor-app`; ghi cách chạy (Node ≥ 20, `docker compose up -d db api`, dev `--host`) vào README từng app.

## 3. Ghi chú thực thi

- R-01 (tutor-app) đóng cùng foundational fix của TA-03. R-01 (tutor-market) tách task riêng vì TM-00 chưa có màn nghiệp vụ dùng client — fix ngay để không nhân bản bug, không chờ.
- R-02/R-03 nên gộp thành một task hạ tầng test (đề xuất mã `INFRA-TEST-01`) trước khi nhận thêm task feature FE mới, để mọi task sau đều có gate smoke.
- Không hạ `DONE` của task cũ; chỉ gắn nhãn "chờ re-certify bằng smoke" cho tới khi R-02 xong.
