# Triển khai `tutor-admin`

Console này chỉ dành cho nội bộ. Reverse proxy/CDN production phải thêm tối thiểu:

- `Content-Security-Policy: default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://<api-host>` (thay API host đúng môi trường, không nới rộng `*`).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `X-Robots-Tag: noindex, nofollow, noarchive` và `Cache-Control: no-store` cho HTML/route protected.

`VITE_API_BASE_URL`, môi trường build và idle timeout chỉ được đặt khi build/deploy. Không thêm công tắc đổi API, token mẫu, analytics session replay hoặc dữ liệu mock vào production.

API production phải cấu hình `CORS_ORIGINS` bằng danh sách origin chính xác của console, bật HTTPS và chỉ gửi admin refresh cookie dạng HttpOnly, `SameSite=Strict`, `Secure`. Không đặt wildcard CORS khi cho phép credentials.

Do refresh cookie dùng `SameSite=Strict`, console và API production phải cùng **site** (cùng registrable domain), tốt nhất reverse proxy API dưới `/api` trên chính origin console. Hai origin khác subdomain vẫn cần CORS credentials chính xác; hai domain khác site sẽ làm browser không gửi cookie và khôi phục phiên thất bại.

Tài khoản admin được provision ngoài giao diện bằng `ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter tutor-api admin:set-password`. Lệnh provision/rotate thu hồi toàn bộ refresh token đang hoạt động của user. Không có đăng ký, quên mật khẩu hoặc đổi provider trên console.
