# Verification Log

File này ghi lại các bước kiểm chứng đã có để tránh mất dấu trạng thái khi làm API.

## Docker Compose: API + Schema + Database + cURL

> **Vị trí:** `docker-compose.yml` nằm trong `tutor-api/` — **chạy mọi lệnh `docker compose ...` dưới đây từ thư mục `tutor-api/`** (hoặc từ root thêm `-f tutor-api/docker-compose.yml`). Cú pháp lệnh không đổi; đường dẫn `/app/tutor-api/scripts/...` trong container giữ nguyên.

Trạng thái: ✅ đã thêm cấu hình verify tự động.

Kết quả chạy gần nhất: ✅ pass ngày 2026-07-14 bằng:

```bash
docker compose up --build --abort-on-container-exit verify
```

Kết quả API/unit mới nhất: ✅ pass ngày 2026-07-16:

- Full Jest API: 16 suite / 93 test pass.
- API lint và Nest production build pass.
- `tutor-admin`: 6 file / 15 test, lint và Vite production build pass.
- `@kimthanh-tutor/contracts`: serialization tests pass.

Evidence Docker/flow gần nhất vẫn là 2026-07-14:

- `docker compose up -d --build api`: Prisma generate + Nest build pass.
- `docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-12-tutor-admin-ops.sh`: Flow 12 pass end-to-end.
- Regression cURL sau refactor billing/access: Flow 7 và Flow 10 pass ngày 2026-07-14; Flow 10 script đã đọc giá `tutor_qr` từ checkout output thay vì hard-code để tương thích `product_pricing`.

File liên quan:

- `tutor-api/docker-compose.yml`
- `tutor-api/Dockerfile`
- `tutor-api/scripts/verify-api-io.sh`

Lệnh chạy:

```bash
docker compose up --build --abort-on-container-exit verify
```

Dọn dữ liệu verify nếu cần chạy lại từ DB sạch:

```bash
docker compose down -v
```

Phạm vi kiểm chứng hiện tại:

- `prisma validate` đọc `tutor-api/prisma/schema.prisma`.
- API container chạy `prisma db push --accept-data-loss` để dựng schema vào PostgreSQL verify.
- `psql` kiểm tra các bảng chính: `users`, `otp_requests`, `tutor_profiles`, `payments`, `class_contracts`, `reviews`, `audit_logs`. Schema hiện còn có `admin_credentials`, `refresh_tokens`, `platform_payment_accounts`, `product_pricing`, `paid_feature_overrides`; bổ sung chúng vào script DB assertion khi mở rộng verify schema.
- `psql` kiểm tra enum chính: `UserStatus`, `ProductType`, `PaymentStatus`, `ClassStatus`.
- `curl` kiểm tra output `GET /healthz`.
- `curl` kiểm tra output `GET /readyz`.
- `curl` kiểm tra input sai `POST /api/v1/auth/register` (domain không phải gmail/edu, password ngắn) trả `400` + `VALIDATION_ERROR`.
- Unit test auth có mock provider cho Google OAuth; Facebook/Google E2E thật cần token provider và env client/app id thật.
- `curl` chạy happy path email + password:
  - register (email gmail/edu + password), nhận `dev_verification_link` ở non-production,
  - login trước verify → `EMAIL_NOT_VERIFIED` (403),
  - verify email + login,
  - gọi `GET /api/v1/auth/me` bằng Bearer token,
  - kiểm tra user ở trạng thái `pending_consent`.
- `psql` kiểm tra DB đã ghi `users` và `email_tokens` (+ `user_credentials`).

Script flow UI đã có:

- `tutor-api/scripts/verify-flow-01-auth-consent.sh`: chạy kịch bản 1 end-to-end bằng cURL, gồm seed legal documents dev, register email+password, login-trước-verify bị chặn (`EMAIL_NOT_VERIFIED`), verify email, login, load legal docs, record consent, reload `/auth/me`, logout revoke.
- `tutor-api/scripts/verify-flow-02-tutor-profile.sh`: chạy kịch bản 2 end-to-end bằng cURL, gồm login/consent, tạo hồ sơ gia sư, thêm availability, thêm payout account, publish profile.
- `tutor-api/scripts/verify-flow-03-guest-search-paywall.sh`: chạy kịch bản 3 end-to-end bằng cURL, gồm tạo tutor published qua Flow 2, search public, xem detail locked/paywall.
- `tutor-api/scripts/verify-flow-04-guest-trial-activation.sh`: chạy kịch bản 4 end-to-end bằng cURL, gồm guest tạo trial, tutor accept, guest complete activation token.
- `tutor-api/scripts/verify-flow-05-parent-onboarding-trial.sh`: chạy kịch bản 5 end-to-end bằng cURL, gồm parent login/consent, bootstrap parent profile, tạo student, gửi trial, xem trial mine.
- `tutor-api/scripts/verify-flow-06-tutor-inbox-lesson-log.sh`: chạy kịch bản 6 end-to-end bằng cURL, gồm tutor inbox, accept trial, chuyển class active, tạo và sửa lesson log.
- `tutor-api/scripts/verify-flow-07-parent-dashboard-tracking.sh`: chạy kịch bản 7 end-to-end bằng cURL, gồm overview miễn phí, detail locked, checkout `parent_tracking`, giả lập webhook SePay, mở dashboard detail.
- `tutor-api/scripts/verify-flow-08-single-unlock-profile.sh`: chạy kịch bản 8 end-to-end bằng cURL, gồm checkout `single_unlock`, giả lập webhook SePay, xem tutor detail unlocked.
- `tutor-api/scripts/verify-flow-09-review-moderation.sh`: chạy kịch bản 9 end-to-end bằng cURL, gồm complete class, parent review, tutor report, admin moderate; script tự grant admin role trong DB verify.
- `tutor-api/scripts/verify-flow-10-tutor-qr-tuition.sh`: chạy kịch bản 10 end-to-end bằng cURL, gồm checkout + webhook gói `tutor_qr`, tạo QR học phí vào tài khoản gia sư, list QR, mark collected.
- `tutor-api/scripts/verify-flow-11-admin-moderation-ops.sh`: chạy kịch bản 11 end-to-end bằng cURL, gồm moderation queue, admin set tutor status, tra payment paid, xem audit log.
- `tutor-api/scripts/verify-flow-12-tutor-admin-ops.sh`: chạy kịch bản 12 end-to-end bằng cURL, gồm dashboard stats, user list/detail, khóa account, system logs, setup VietQR nền tảng, setup pricing, toggle paid feature theo user, xác minh checkout đọc pricing/account/override, và dùng lại moderation queue.

Ghi chú:

- Vì repo chưa có `prisma/migrations`, verify dùng `prisma db push` cho môi trường local/Docker. Khi có migration chính thức, đổi API command sang `prisma migrate deploy`.
- Script cố ý in response JSON mẫu để kiểm tra input/output bằng mắt khi debug.
- PostgreSQL trong compose chỉ expose qua Docker network nội bộ để tránh đụng port `5432` trên máy dev; service `verify` dùng `psql` nội bộ để kiểm tra DB.

Lệnh chạy riêng Flow 1 khi API container đang chạy:

```bash
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-01-auth-consent.sh
```

Lệnh chạy riêng Flow 2 khi API container đang chạy:

```bash
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-02-tutor-profile.sh
```

Lệnh chạy riêng Flow 3 khi API container đang chạy:

```bash
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-03-guest-search-paywall.sh
```

Lệnh chạy riêng Flow 4-12 khi API container đang chạy:

```bash
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-04-guest-trial-activation.sh
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-05-parent-onboarding-trial.sh
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-06-tutor-inbox-lesson-log.sh
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-07-parent-dashboard-tracking.sh
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-08-single-unlock-profile.sh
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-09-review-moderation.sh
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-10-tutor-qr-tuition.sh
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-11-admin-moderation-ops.sh
docker compose exec -T api sh /app/tutor-api/scripts/verify-flow-12-tutor-admin-ops.sh
```

## Frontend E2E smoke (BẮT BUỘC cho màn có gọi API)

**Bài học 2026-07-18 (vì sao mục này tồn tại).** Bug `ApiClient` lưu native `fetch` vào field rồi gọi `this.fetcher(...)` → `fetch` chạy với `this = ApiClient` thay vì `window` → trình duyệt ném `TypeError: Illegal invocation` **trước khi request rời máy** → mọi lời gọi API của app hỏng, hiện "Không thể kết nối máy chủ", **không có entry Network**. Nhưng 93 unit test vẫn xanh vì test luôn inject fetcher giả (`vi.fn`) và script cURL gọi thẳng API (không qua browser). Bug chỉ lộ khi **click thật trên browser**. Kết luận: unit test + cURL **không đủ** để chứng nhận một màn frontend "chạy được".

Quy tắc từ nay:

- Mỗi màn frontend có gọi API phải có **ít nhất một smoke Playwright headless** chạy happy-path qua **API thật (dockerized)**, khẳng định request `POST/GET /api/...` thật trả `2xx` trên Network và một hành động ghi/đọc chính hiển thị đúng.
- `ApiClient` (và các ranh giới tích hợp dùng chung: token store, oauth adapter) phải có ≥1 test chạy **implementation thật** — vd test mô phỏng ràng buộc `this` của native `fetch` để chặn tái phát bug binding (`tutor-app/src/lib/api/client.test.ts`).
- Bằng chứng `DONE` của task frontend phải gồm smoke browser xanh (hoặc log Network/ảnh chụp từ browser thật), không chỉ "unit test xanh".

Harness dùng chung: **`tutor-e2e/`** (một Playwright project cho cả 3 app — đồng bộ config/seed/cách chạy). Chrome hệ thống (`channel: chrome`, không tải browser). Multi-project (`tutor-app`/`tutor-admin`/`tutor-market`) + multi-webServer.

Cách chạy:

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"   # Node ≥ 20 (.nvmrc)
docker compose up -d db api                                 # API tại localhost:3000
pnpm --filter @kimthanh-tutor/e2e test                      # cả 3 app
pnpm --filter @kimthanh-tutor/e2e test:app                  # hoặc test:admin | test:market
```

Nguyên tắc bảo mật của harness:

- **Không hardcode secret.** Password admin + password gia sư sinh ngẫu nhiên lúc chạy, lưu vào `tutor-e2e/.e2e-state/` (gitignored); link verify/reset đọc từ `dev_verification_link`/`dev_reset_link` trong response API. Chỉ định danh tài khoản test (email) là hằng số, không phải thông tin DB.
- **Không nhúng credential/tên container.** Seed truy cập DB/API qua `docker compose exec db|api` (service từ chính compose file), không hardcode tên container hay mật khẩu DB.
- Dev không dính CORS/IPv4-IPv6 nhờ dev proxy `/api` trong `vite.config.ts` của tutor-app/tutor-admin; tutor-market SSR fetch server-side.
- Throttle OTP là 5 lần/5 phút theo IP → gộp login trong một smoke khi có thể; token tutor/parent memory-only nên điều hướng client-side sau login (không `page.goto` route bảo vệ).

## Quy tắc cập nhật docs sau mỗi task API

Sau mỗi task API/hạ tầng, cập nhật tối thiểu:

- `ai-tasks/05-api-endpoints.md` nếu endpoint, quyền, I/O hoặc trạng thái implement thay đổi.
- `ai-tasks/06-verification.md` nếu thêm/sửa cách verify.
- `ai-tasks/07-api-curl-user-flows.md` nếu thêm/sửa luồng người dùng, màn hình, payload cURL hoặc expected output phục vụ mock UI/UX.
- README tương ứng (`README.md`, `tutor-api/README.md`, `tutor-market/README.md`, `tutor-app/README.md`) nếu cách chạy hoặc trạng thái dự án thay đổi.
- Với thay đổi admin, cập nhật thêm `tutor-admin/README.md` và `tutor-admin/DEPLOYMENT.md` nếu auth/cookie/header/deployment invariant đổi.
- `ai-tasks/01-backlog.md` hoặc `02-milestones.md` nếu task/mốc đã hoàn tất hoặc đổi phạm vi.

Quy tắc riêng khi ráp API vào mock UI/UX:

- `07-api-curl-user-flows.md` là contract ráp UI. Mock UI gọi đúng flow mà failed thì phải xem lại API/business flow trước, không vá tạm ở UI.
- Mỗi lần test failed phải ghi rõ flow nào failed, nguyên nhân, API đã refactor/improve gì, và status mới trong bảng `Status tổng quan`.
- Chỉ chuyển flow sang `Verified` sau khi chạy được toàn bộ chuỗi API theo hành động thật của user trên màn hình đó.
