# tutor-app

React workspace dành cho gia sư. App này là khu vực đăng nhập, chạy theo mô hình SPA; các trang public/SEO thuộc `tutor-market`.

## Lệnh phát triển

```bash
pnpm --filter tutor-app dev
pnpm --filter tutor-app lint
pnpm --filter tutor-app test
pnpm --filter tutor-app build
```

API base được đóng tại build time bằng `VITE_API_BASE_URL` (mặc định `/api/v1`). Production UI không cho sửa API base, đọc token hay xóa storage.

Phương thức đăng nhập hoạt động chính là email + password (đăng ký → verify email qua link → login → quên/đặt lại mật khẩu). Đăng nhập Google dùng luồng Authorization Code **server-side**: nút Google chỉ là link tới `/auth/oauth/google/start`, FE **không cần** `VITE_GOOGLE_CLIENT_ID`. Facebook (client-side) đọc `VITE_FACEBOOK_APP_ID` và `VITE_FACEBOOK_API_VERSION`; URL quay về chợ gia sư đọc `VITE_MARKET_URL`. Nếu provider OAuth chưa cấu hình, UI báo không khả dụng, không giả lập đăng nhập.

## Kiến trúc nền

- `src/app`: route, shell, error boundary.
- `src/components`: primitive dùng chung.
- `src/lib/api`: typed client, refresh single-flight và normalized error.
- `src/lib`: format UTC/VND và capability guard.
- `src/styles`: design tokens và responsive workspace shell bám mock.

Các màn đã có API thật: auth/consent (`TA-01`), hồ sơ/media (`TA-02`), lịch rảnh/bận (`TA-03`), dashboard công việc (`TA-04`) và inbox yêu cầu học thử (`TA-05`). Route business còn lại vẫn là placeholder có chủ đích và được triển khai theo `ai-tasks/10-tutor-app-task-list.md`.

Trạng thái: `TA-00`–`TA-05` DONE; current task `TA-06` (danh sách lớp, chi tiết và state machine). Không xem placeholder của các task sau là feature đã hoàn tất.
