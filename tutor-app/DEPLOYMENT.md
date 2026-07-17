# Triển khai `tutor-app`

App gia sư là bề mặt **private** (authenticated + consent + role `tutor`), không được index. Reverse proxy/CDN production phải thêm tối thiểu:

- `Content-Security-Policy: default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://<api-host>` (thay API host đúng môi trường, không nới rộng `*`).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `X-Robots-Tag: noindex, nofollow, noarchive` và `Cache-Control: no-store` cho HTML/route protected.

`VITE_API_BASE_URL` và môi trường build chỉ đặt khi build/deploy. Không thêm công tắc đổi API, token mẫu, analytics session replay hay dữ liệu mock vào production. Access/refresh token giữ trong memory store (không browser storage/log).

API production phải cấu hình `CORS_ORIGINS` bằng danh sách origin chính xác của app, bật HTTPS. Không đặt wildcard CORS khi cho phép credentials.
