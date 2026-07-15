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

## Kiến trúc nền

- `src/app`: route, shell, error boundary.
- `src/components`: primitive dùng chung.
- `src/lib/api`: typed client, refresh single-flight và normalized error.
- `src/lib`: format UTC/VND và capability guard.
- `src/styles`: design tokens và responsive workspace shell bám mock.

Các màn hiện là placeholder có chủ đích của `TA-00`; business flow được triển khai theo từng task tiếp theo trong `ai-tasks/10-tutor-app-task-list.md`.
