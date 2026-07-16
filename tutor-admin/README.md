# tutor-admin

SPA React/Vite dành riêng cho vận hành nội bộ. Form đăng nhập chỉ nhận email/password admin đã provision; route luôn gọi `/auth/me`, chặn role không phải `admin` trước khi render shell, không lưu token trong browser storage và không có công tắc API/demo token trên giao diện production. Access token chỉ ở RAM; API giữ refresh token trong cookie HttpOnly để reload vẫn khôi phục được phiên.

## Lệnh

```bash
pnpm --filter tutor-admin dev
pnpm --filter tutor-admin lint
pnpm --filter tutor-admin test
pnpm --filter tutor-admin build
```

Dev server tự proxy `/api/*` sang `http://127.0.0.1:3000`, nên cấu hình mặc định
`VITE_API_BASE_URL=/api/v1` hoạt động với API local mà không cần đổi origin.

Biến build: xem [`.env.example`](.env.example). Header production/CSP/noindex/cache-control bắt buộc: xem [`DEPLOYMENT.md`](DEPLOYMENT.md).

Provision hoặc rotate password cho một user đã có role `admin`:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='mật-khẩu-tối-thiểu-12-ký-tự' pnpm --filter tutor-api admin:set-password
```

Rotate password luôn thu hồi toàn bộ refresh token còn hoạt động của admin đó.

Các route shell là placeholder có chủ đích; màn nghiệp vụ được triển khai lần lượt theo `AD-01` đến `AD-09`.

Trạng thái ngày 2026-07-16: `AD-00` DONE; 6 file / 15 test pass, lint và production build pass. API client retry tối đa hai lần khi refresh gặp `409` do tab khác vừa rotate token; lỗi refresh tạm thời 5xx/network chỉ xóa access token trong RAM, không chủ động logout hoặc xóa refresh cookie còn hợp lệ.
