# Verification Log

File này ghi lại các bước kiểm chứng đã có để tránh mất dấu trạng thái khi làm API.

## Docker Compose: API + Schema + Database + cURL

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

- `docker-compose.yml`
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
- `curl` kiểm tra input sai `POST /api/v1/auth/otp/request` trả `400` + `VALIDATION_ERROR`.
- Unit test auth có mock provider cho Google OAuth; Facebook/Google E2E thật cần token provider và env client/app id thật.
- `curl` chạy happy path OTP fallback/local:
  - request OTP SMS,
  - lấy `dev_code` cố định `272727` ở môi trường non-production,
  - verify OTP,
  - gọi `GET /api/v1/auth/me` bằng Bearer token,
  - kiểm tra user ở trạng thái `pending_consent`.
- `psql` kiểm tra DB đã ghi `users` và `otp_requests`.

Script flow UI đã có:

- `tutor-api/scripts/verify-flow-01-auth-consent.sh`: chạy kịch bản 1 trong `07-api-curl-user-flows.md` end-to-end bằng cURL, gồm seed legal documents dev, OTP fallback local với mã `272727`, load legal docs, record consent, reload `/auth/me`.
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
