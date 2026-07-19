# Bảo Mật Và Mô Hình Rủi Ro

Tài liệu này liệt kê các mối đe dọa chính và biện pháp bắt buộc. Đây là hàng rào bảo vệ tiền và dữ liệu — sai ở đây là mất tiền, mất dữ liệu khách, mất uy tín. Đọc kèm `14-data-privacy-and-compliance.md` (quyền riêng tư/pháp lý) và `11-database-erd.md` (bảng liên quan).

## 1. Nguyên tắc nền

- **Không tin giao diện.** Mọi quyết định quyền/tiền/trạng thái kiểm tra ở phía máy chủ; frontend chỉ để trải nghiệm.
- **Least privilege.** Mỗi vai trò chỉ thấy/làm đúng phần của mình; mọi truy cập tài nguyên kiểm tra quyền sở hữu.
- **Defense in depth.** Rate limit + xác thực + phân quyền + validate đầu vào + audit, không dựa vào một lớp.
- **Fail closed.** Không chắc quyền thì từ chối, không mặc định cho phép.

## 2. Xác thực & phiên (auth/session)

- **Đăng nhập parent/tutor**: **email + password** và **Google OAuth (server-side, đã hoạt động)** là hai phương thức đang chạy; **Facebook OAuth** là đích lâu dài. Server verify token trực tiếp với provider (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, Facebook app id/secret), không tin profile client gửi. Chi tiết luồng Google server-side ở gạch đầu dòng "Google OAuth" phía dưới.
- Console `tutor-admin` dùng email/password riêng đã provision ngoài UI. Chỉ lưu scrypt hash trong `admin_credentials`, kiểm tra role `admin` và trạng thái ở server, dùng thông báo sai credential chung, rate limit theo IP và khóa credential 15 phút sau 5 lần sai. Counter sai phải tăng bằng compare-and-swap/ghi nguyên tử để request song song không làm mất increment. Access token chỉ ở RAM; refresh token admin nằm trong cookie HttpOnly, `SameSite=Strict`, `Secure` ở production, quay vòng nguyên tử mỗi lần khôi phục và bị thu hồi khi logout. Rotation chỉ một request được claim token cũ; xung đột multi-tab trong grace ngắn không được revoke/clear token con của request thắng, còn reuse sau grace phải thu hồi mọi refresh token đang hoạt động của user. Rotate password cũng phải thu hồi mọi refresh token đang hoạt động. Không có đăng ký/quên mật khẩu public cho admin.
- **Email + password (parent/tutor)**: chỉ nhận email `@gmail.com` hoặc domain chứa `edu`. Password scrypt (`user_credentials`), thông báo sai credential chung, khóa tạm sau nhiều lần sai (CAS nguyên tử như admin), rate limit login theo IP. **SĐT chỉ để liên hệ, không đăng nhập** (bỏ OTP-SMS để giảm chi phí + bề mặt tấn công).
- **Google OAuth (server-side Authorization Code)**: đăng nhập/đăng ký Google chạy hoàn toàn phía server để không lộ token/secret ra browser. `GET /auth/oauth/google/start` đặt nonce chống CSRF vào cookie `kt_oauth_state` (HttpOnly, `SameSite=Lax` để nhận được khi Google redirect top-level về) rồi redirect sang Google; `GET /auth/oauth/google/callback` verify `state==nonce`, đổi `code` lấy `id_token` bằng `client_secret` (chỉ ở server, không rời máy chủ), verify `aud`/email-verified, register-or-login, set cookie phiên `kt_refresh` rồi redirect về FE. `return_to` phải thuộc allowlist `OAUTH_RETURN_URLS` và `next` phải là path nội bộ (chống open-redirect). FE boot dùng silent `/auth/refresh` (R-05) để nhận access token — không có token nào nằm trong URL.
- **Verify email bắt buộc**: đăng ký tạo tài khoản `pending_verification`; login bị chặn (`EMAIL_NOT_VERIFIED`) tới khi bấm link verify. Token verify/reset lưu **hash** (`email_tokens`), có `expires_at`, **dùng một lần**; tạo token mới vô hiệu token cũ cùng loại.
- **Quên mật khẩu**: `POST /auth/password/forgot` **luôn trả 200** (chống account enumeration); chỉ gửi email khi có credential. `reset` đổi password + **thu hồi mọi refresh token** đang sống. Endpoint register/forgot/resend rate limit 5/5 phút theo IP.
- **Gửi email** qua Resend (`RESEND_API_KEY`); non-production thiếu key → trả `dev_verification_link`/`dev_reset_link` để test (không lộ ở production).
- **Token**: JWT access ngắn hạn (vd 15 phút) + refresh token quay vòng. Access token chỉ giữ trong RAM tab (không local/session storage — chống XSS đọc trộm). **Refresh token của parent/tutor nằm trong cookie HttpOnly `kt_refresh`** (`SameSite=Strict`, `Secure` ở production, `path=/api/v1/auth`), đồng bộ mô hình admin — không bao giờ trả ra body cho JavaScript. Boot app đổi cookie tại `POST /auth/refresh` để **giữ đăng nhập qua reload** (R-05); tab đua rotate nhận `409 CONFLICT` trong grace ngắn và retry thay vì bị logout. `login`/`oauth/*` set cookie; `refresh` rotate + set lại; `logout` đọc cookie để revoke + clear. Server lưu hash refresh token, liên kết `rotated_to_id` và trạng thái revoke trong PostgreSQL `refresh_tokens`. Cùng-origin (reverse proxy/Next rewrite) nên `SameSite=Strict` đủ chống CSRF, không cần double-submit token. Redis không phải nguồn chân lý phiên và hiện chưa là dependency runtime.
- **Consent gating**: user `pending_consent` không được thực hiện hành động chính thức (`08-legal-consent-and-privacy.md`).

## 3. Phân quyền (authorization) — mô hình có hệ thống

Không kiểm tra quyền rải rác theo cảm tính. Áp dụng chung:

- **RBAC theo vai trò** (`guest/parent/tutor/admin/system`) cho khả năng thô.
- **Ownership check** cho mọi tài nguyên có chủ: guard/policy xác minh tài nguyên thuộc về user đang gọi trước khi đọc/ghi. Ví dụ:
  - Phụ huynh chỉ thao tác `students`, `trial_requests`, `reviews`, `subscriptions` của chính `parent_profile_id` mình.
  - Gia sư chỉ thao tác `tutor_profiles`, `lesson_logs`, `class_contracts`, `qr_records` gắn `tutor_profile_id` mình.
  - Dashboard chi tiết yêu cầu vừa là phụ huynh của lớp **và** có `subscriptions(parent_tracking, active, scope_ref_id=student)`.
- **Chống IDOR**: không bao giờ tin `id` client gửi để suy ra quyền; luôn kiểm tra chủ sở hữu ở tầng service. ID dùng ULID (khó đoán) nhưng vẫn phải check quyền.
- **Admin**: mọi hành động admin ghi `audit_logs` (actor, action, entity, before/after hash, IP).

## 4. Bảo mật đường tiền (payment) — nghiêm ngặt nhất

Mối đe dọa: giả mạo webhook để được cấp quyền miễn phí; replay; sai số tiền; double-spend.

Với VietQR + webhook biến động số dư ngân hàng (SePay/Casso), "provider" chính là dịch vụ này; các biện pháp dưới đây áp dụng y hệt.

Biện pháp **bắt buộc**:

1. **Verify chữ ký/API key webhook** (HMAC/secret của provider; với SePay là API key + IP allowlist) trên payload thô trước khi tin. Sai → từ chối, ghi `webhook_events(signature_verified=false, invalid)`.
2. **Đối chiếu số tiền & mã đơn**: `amount`/`currency` và **mã đơn duy nhất trong nội dung chuyển khoản** (map `payments.provider_reference`) phải khớp `payments` đã tạo. Lệch → không cấp quyền, cảnh báo admin. Lưu ý VietQR trần không ràng buộc người trả nhập đúng nội dung → phải đối chiếu mã + số tiền, và xử lý ca trả thiếu/thừa/sai nội dung.
3. **Chống trùng/replay**: `webhook_events (provider, provider_reference)` UNIQUE; nhận lại → đánh dấu `duplicate`, không xử lý lại.
4. **Idempotency tạo phiên**: client gửi `Idempotency-Key`; lưu `idempotency_keys` để double-submit không tạo 2 giao dịch.
5. **Chỉ cấp quyền khi `paid`**, trong transaction, với optimistic lock trên `payments.version`.
6. **Refund**: thu hồi/hết hạn quyền liên quan theo chính sách; ghi `refunds` + `audit_logs`.
7. **QR gia sư**: nhấn mạnh nền tảng KHÔNG thu hộ, KHÔNG xác nhận dòng tiền học phí → tránh trách nhiệm pháp lý và hiểu nhầm. `tutor_payout_accounts` là PII, chỉ chủ sở hữu xem.

## 5. Bảo vệ nội dung & chống "đi vòng" nền tảng (disintermediation)

Doanh thu phụ thuộc việc phụ huynh trả tiền mở khóa và giữ giao dịch trên nền tảng. Rủi ro: lộ liên hệ sớm → hai bên bỏ nền tảng.

- **Không hiển thị SĐT/email** ở bản xem thử công khai và trong review/mô tả/video.
- **Phát hiện & chặn liên hệ ngoài**: quét SĐT/email/link trong `bio`, mô tả, review, và (nếu có) bản chép lời video → cảnh báo/ẩn theo chính sách.
- **Chia sẻ liên hệ có kiểm soát**: chỉ mở theo rule đã chốt (sau khi gia sư chấp nhận / phụ huynh đăng ký). Ghi lại thời điểm mở.
- **Video/đánh giá** chỉ trả **signed URL hết hạn ngắn** khi user có quyền (unlock/VIP), không trả URL public vĩnh viễn.
- Ràng buộc bằng Điều khoản sử dụng (cấm lôi kéo giao dịch ngoài) — tầng pháp lý.

## 6. Chống scraping chợ gia sư

Cơ sở dữ liệu gia sư là tài sản; đối thủ có thể cào để sao chép.

- **Rate limit** API search/chi tiết theo IP + phiên + fingerprint; ngưỡng cao hơn cho user đăng nhập tin cậy.
- **Phân tầng dữ liệu**: bản xem thử tối thiểu; dữ liệu giá trị (review/video) sau paywall + signed URL.
- **Phát hiện bất thường**: cảnh báo khi 1 nguồn quét số trang lớn bất thường; CAPTCHA/temporary block.
- **Không trả trường nhạy cảm** trong API công khai; giới hạn kích thước trang.

## 7. Upload media (ảnh đại diện, video giới thiệu)

- **Signed/presigned upload** trực tiếp lên object storage; API chỉ cấp quyền upload, không proxy file lớn.
- **Validate**: content-type, kích thước tối đa, đuôi/định dạng; từ chối loại nguy hiểm.
- **Quét virus/malware** (`media_assets.scan_status`) trước khi cho public.
- **Kiểm duyệt nội dung** (`moderation_status`) trước khi hiển thị: video/ảnh chỉ public sau `approved`.
- Phục vụ media qua signed URL hết hạn ngắn, đặc biệt nội dung sau paywall.

## 8. Validate đầu vào & chống injection

- Validate mọi input bằng DTO/schema (class-validator ở NestJS); từ chối field thừa.
- Dùng **query tham số hóa/ORM** (Prisma) — không nối chuỗi SQL. Raw SQL (index/partition) chỉ trong migration, không nhận input người dùng.
- Chống XSS: sanitize nội dung do người dùng nhập (bio, review, message) khi render; escape đúng ngữ cảnh.
- Chống mass-assignment: chỉ nhận field cho phép; không map thẳng body vào entity.
- Giới hạn kích thước payload; chống JSON bomb.

## 9. Rate limiting (tổng hợp)

| Đối tượng | Lý do | Chiến lược |
| --- | --- | --- |
| Login/register/forgot | Chống brute-force credential | Theo IP, khóa tạm sau nhiều lần sai (CAS), cooldown |
| Search/chi tiết công khai | Chống scraping/DoS | Theo IP + fingerprint; token bucket Redis khi bật shared limiter |
| Tạo trial request (guest) | Chống spam gia sư | Theo IP + SĐT lead, giới hạn/giờ |
| Tạo phiên thanh toán | Chống lạm dụng | Theo user + idempotency key |
| API ghi nói chung | Ổn định | Giới hạn theo user/tenant |

Trả mã lỗi chuẩn `RATE_LIMITED` + `Retry-After`.

Trạng thái 2026-07-16: limiter hiện dùng `@nestjs/throttler` in-memory. Phải thay/bổ sung store dùng chung trước khi scale ngang trên một instance; Redis trong bảng trên là target deployment, không phải capability đang chạy.

## 10. Bí mật & cấu hình

- Secrets (khóa provider, JWT secret, DB creds, HMAC webhook) qua **biến môi trường/secret manager**; không commit, không log.
- Tách secret theo môi trường (dev/staging/prod); quay vòng định kỳ.
- Bật TLS mọi kết nối; DB không mở ra Internet công khai.

## 11. Ghi log an toàn & audit

- **Không log PII/secret** (SĐT đầy đủ, mật khẩu, token, số tài khoản). Mask khi cần.
- `audit_logs` cho hành động nhạy cảm (admin, thay đổi quyền, hoàn tiền, kiểm duyệt) — append-only.
- Log có `request_id` để trace nhưng không lộ dữ liệu nhạy cảm.

## 12. Bảng mối đe dọa → biện pháp (tóm tắt)

| Mối đe dọa | Biện pháp chính |
| --- | --- |
| Giả mạo webhook để mở khóa miễn phí | Verify chữ ký + đối chiếu số tiền + chống trùng |
| Double-accept/ race trạng thái | Optimistic lock (`version`) + transaction |
| IDOR (xem dữ liệu người khác) | Ownership check ở service, fail closed |
| Brute-force credential (login) | Rate limit + khóa tạm + hash password (scrypt) + cooldown |
| Scraping DB gia sư | Rate limit + phân tầng dữ liệu + phát hiện bất thường |
| Đi vòng nền tảng (mất doanh thu) | Ẩn liên hệ + phát hiện liên hệ ngoài + signed URL + ToS |
| Upload mã độc/nội dung xấu | Signed upload + validate + quét virus + kiểm duyệt |
| Rò rỉ PII trẻ vị thành niên | Phân loại PII + hạn chế log + retention + ẩn danh (`14-...`) |
| Mất sự kiện (thông báo/cấp quyền) | Outbox at-least-once + retry + dead-letter |
| Lộ secret | Secret manager + không log + quay vòng |
