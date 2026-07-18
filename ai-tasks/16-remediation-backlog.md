# Remediation Backlog — Nợ Kỹ Thuật & Khắc Phục Quy Trình

Danh sách tập trung các vấn đề phát hiện khi kiểm thử thực tế trên browser (2026-07-18), cần fix cho **task cũ** (đã `DONE`) lẫn **task hiện tại**. File này là nguồn theo dõi việc khắc phục; khi một mục xong, đánh `DONE` kèm commit/evidence và, nếu là thay đổi hành vi, cập nhật doc tương ứng.

Thứ tự ưu tiên: `P0` chặn/đang hỏng thật → `P1` gate quy trình → `P2` UX/kiến trúc cần chốt.

## 0. Nguyên nhân gốc (systemic)

Các task frontend được chứng nhận `DONE` bằng **unit/component test (fetch mock) + script cURL**, **chưa từng** chạy màn trên **browser thật** với API thật. Hệ quả: một bug phá **toàn bộ** lời gọi API vẫn lọt qua 93 unit test xanh. Quy trình đã sửa ở commit `docs(process): bắt buộc E2E smoke browser thật` — backlog này là phần dọn nợ đã tích lũy trước đó.

## 1. Bảng vấn đề

| ID | Ưu tiên | Vấn đề | Phạm vi / task chạm | Trạng thái |
| --- | --- | --- | --- | --- |
| R-01 | P0 | `ApiClient` lưu native `fetch` vào field rồi gọi `this.fetcher(...)` → `this = ApiClient` → `TypeError: Illegal invocation`, **hỏng mọi API call trên browser**, không có entry Network | `tutor-app` (TA-00 client, dùng bởi TA-01/02/03); `tutor-market` (TM-00 client) | ✅ **DONE** — tutor-app + tutor-market fix `fetch.bind(globalThis)` + regression test; tutor-admin đúng sẵn (chuẩn tham chiếu) |
| R-02 | P1 | Không có E2E smoke browser thật cho bất kỳ màn FE nào; task `DONE` chỉ bằng unit test + cURL | TA-00, TA-01, TA-02, TA-03, TM-00, AD-00 | ✅ **DONE (baseline)** — mỗi app có smoke happy-path: tutor-app (profile TA-02, availability TA-03), tutor-admin (login→overview AD-00), tutor-market (home search SSR TM-00). Smoke theo từng feature tiếp tục tích lũy qua DoD mới |
| R-03 | P1 | Chưa có harness Playwright trong 3 app (chạy headless với API dockerized) | `tutor-app`, `tutor-market`, `tutor-admin` | ✅ **DONE** — cả 3 app có `playwright.config.ts` + `e2e/` (Chrome hệ thống, `pnpm --filter <app> test:e2e`), seed qua API/DB container |
| R-04 | P1 | Thiếu test ranh giới bằng implementation thật cho `ApiClient` (bắt lỗi unbound `fetch`) | tutor-app, tutor-market, tutor-admin | ✅ **DONE** — cả 3 app có regression test mô phỏng ràng buộc `this` của native fetch |
| R-05 | P2 | Chưa chốt chiến lược phiên đăng nhập: memory-only (reload = login lại) vs refresh cookie HttpOnly cho tutor/parent | `tutor-app`, `tutor-market`, `tutor-api` auth | ⚪ OPEN — quyết định sản phẩm (`04-open-questions.md`) |
| R-06 | P2 | Chạy dev local dính CORS + IPv4/IPv6 (Vite bind `::1`, API IPv4, CORS thiếu `localhost`) | tutor-app: ✅ dev proxy; tutor-admin: ✅ có proxy sẵn; tutor-market: SSR (fetch server-side, không cross-origin browser) | ✅ **DONE** cho nhu cầu hiện tại; xét lại khi tutor-market dựng private shell gọi API browser-side (TM-03) |

## 2. Chi tiết & cách fix

### R-01 — Bug binding `fetch` (P0) — ✅ DONE

- Chuẩn đúng: `tutor-admin/src/lib/api/client.ts` bọc `((input, init) => globalThis.fetch(input, init))`.
- `tutor-app` + `tutor-market`: `?? fetch` → `?? fetch.bind(globalThis)` + regression test mô phỏng ràng buộc `this` của native fetch.

### R-02 / R-03 — Tầng E2E smoke (P1) — ✅ DONE

- Dựng **một** package chung `tutor-e2e/` (thay vì rải rác trong từng app): Playwright multi-project + multi-webServer, Chrome hệ thống, seed dùng chung, chạy `pnpm --filter @kimthanh-tutor/e2e test`.
- Smoke hiện có: `tutor-app` (TA-02 hồ sơ + TA-03 lịch trong một phiên login), `tutor-admin` (AD-00 login→overview), `tutor-market` (TM-00 home search SSR).
- Không hardcode secret: password admin sinh ngẫu nhiên (gitignored), OTP đọc từ `dev_code`; DB/API qua `docker compose exec`.
- Smoke theo từng feature tiếp tục thêm vào `tutor-e2e` qua DoD mới. Các task `DONE` cũ còn thiếu smoke chuyên biệt vẫn ghi "browser-unverified" cho tới khi có smoke tương ứng.

### R-04 — Test ranh giới thật (P1) — ✅ DONE

- Cả 3 app có ≥1 test `ApiClient` mô phỏng ràng buộc `this` của native fetch (`*/src/lib/api/client.test.ts`).

### R-05 — Chiến lược phiên (P2)

- Chốt trong `04-open-questions.md`. Nếu chọn HttpOnly cookie cho tutor/parent → mở task refactor `tutor-api` auth (set/clear cookie, `SameSite`/CSRF, rotation) + FE bỏ nhận refresh trong body, đồng bộ với mô hình `tutor-admin`.

### R-06 — Ergonomics dev (P2) — ✅ DONE cho nhu cầu hiện tại

- Dev proxy `/api` đã có ở `tutor-app` + `tutor-admin`; `tutor-market` SSR fetch server-side (không cross-origin browser). Xét lại khi tutor-market dựng private shell gọi API browser-side (TM-03).

## 3. Ghi chú thực thi

- R-01 (tutor-app) đóng cùng foundational fix của TA-03. R-01 (tutor-market) tách task riêng vì TM-00 chưa có màn nghiệp vụ dùng client — fix ngay để không nhân bản bug, không chờ.
- R-02/R-03 nên gộp thành một task hạ tầng test (đề xuất mã `INFRA-TEST-01`) trước khi nhận thêm task feature FE mới, để mọi task sau đều có gate smoke.
- Không hạ `DONE` của task cũ; chỉ gắn nhãn "chờ re-certify bằng smoke" cho tới khi R-02 xong.
