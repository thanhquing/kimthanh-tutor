# Quyền Riêng Tư Dữ Liệu Và Tuân Thủ Pháp Lý

Tài liệu này bổ sung cho `08-legal-consent-and-privacy.md`, tập trung vào **tuân thủ pháp luật Việt Nam về dữ liệu cá nhân** và **xử lý dữ liệu trẻ vị thành niên**. Đây là rủi ro pháp lý sống-còn: sản phẩm xử lý dữ liệu học sinh (trẻ em) và dữ liệu cá nhân của phụ huynh/gia sư.

> Lưu ý: đây là hướng dẫn kỹ thuật/sản phẩm, không thay thế tư vấn pháp lý. Cần luật sư rà bản Điều khoản/Chính sách chính thức trước khi ra mắt.

## 1. Khung pháp lý áp dụng

- **Nghị định 13/2023/NĐ-CP** về bảo vệ dữ liệu cá nhân (PDPD) — hiệu lực tại VN. Yêu cầu cốt lõi cần phản ánh trong hệ thống:
  - Có **cơ sở xử lý hợp pháp** và **sự đồng ý** rõ ràng, tách bạch mục đích.
  - **Dữ liệu cá nhân nhạy cảm** phải xử lý cẩn trọng hơn.
  - Chủ thể dữ liệu có quyền **truy cập, chỉnh sửa, xóa, rút đồng ý, phản đối**.
  - Thông báo khi có **vi phạm dữ liệu**.
  - Có thể phải lập **hồ sơ đánh giá tác động xử lý dữ liệu cá nhân**.
- **Dữ liệu trẻ em** (học sinh, phần lớn dưới 16 tuổi): cần **sự đồng ý của cha mẹ/người giám hộ** và mức bảo vệ cao hơn.

## 2. Phân loại dữ liệu (data classification)

| Mức | Ví dụ trong hệ thống | Xử lý |
| --- | --- | --- |
| **Nhạy cảm/PII cao** | SĐT, email (🔒), số tài khoản ngân hàng gia sư, dữ liệu học sinh (tên, khối, mục tiêu học), IP/user agent trong consent | Hạn chế truy cập theo vai trò; cân nhắc mã hóa cột; không log; retention có hạn |
| **PII thường** | display_name, vùng miền, giới tính tự khai | Kiểm soát truy cập; hiển thị đúng ngữ cảnh |
| **Tự khai chưa xác minh** | điểm thi, GPA, trường học | Không diễn đạt như đã được nền tảng xác thực; có disclaimer |
| **Công khai** | bản xem thử hồ sơ đã published | Ai cũng xem, nhưng không kèm liên hệ trực tiếp |

Trong ERD, trường PII được đánh dấu 🔒. Danh mục này là nguồn tham chiếu khi thiết kế log, cache, API response.

## 3. Dữ liệu trẻ vị thành niên (học sinh)

- Học sinh **không có tài khoản riêng**; dữ liệu do phụ huynh tạo/quản lý.
- **Cơ sở xử lý = đồng ý của phụ huynh** (người giám hộ), thu tại bước consent của phụ huynh.
- **Tối thiểu hóa**: chỉ thu tên/khối/mục tiêu học phục vụ matching và theo dõi học tập; không thu thông tin trẻ em ngoài mục đích.
- **Không public dữ liệu học sinh** ở chợ gia sư hay bất kỳ bề mặt công khai nào.
- Cân nhắc cho phép dùng **biệt danh** cho học sinh thay vì tên thật.
- Dashboard chi tiết (dữ liệu học tập của trẻ) chỉ mở cho phụ huynh sở hữu + gói tracking hợp lệ.

## 4. Đồng ý (consent) — kỹ thuật

Theo `08-legal-consent-and-privacy.md` + ERD (`legal_documents`, `legal_consents`):

- Lưu **version tài liệu** (`legal_documents` với `doc_type`, `version`, `checksum`) và **bản ghi đồng ý bất biến** (`legal_consents`, append-only, không ghi đè).
- Ghi `role_at_acceptance`, `accepted_at`, `scroll_reached_bottom`, `consent_method`, và `ip_address`/`user_agent` **chỉ khi chính sách cho phép** (bản thân IP/UA là PII).
- Khi cập nhật version → có thể yêu cầu đồng ý lại; **không xóa consent cũ**, tạo bản mới → truy vết được người dùng đã đồng ý bản nào, khi nào.
- Đồng ý cho các mục đích tách bạch: vận hành dịch vụ vs. thông báo tiếp thị (nếu có) là hai đồng ý khác nhau.

## 5. Quyền của chủ thể dữ liệu (DSR)

Hệ thống cần hỗ trợ (có thể qua thao tác admin giai đoạn 1, nhưng phải làm được):

- **Truy cập/xuất dữ liệu**: người dùng xem/được cung cấp dữ liệu cá nhân của mình.
- **Chỉnh sửa**: sửa hồ sơ, thông tin liên hệ.
- **Xóa/rút đồng ý**: xem mục 6.
- **Phản đối/hạn chế xử lý**: dừng thông báo tiếp thị, v.v.
- Ghi nhận và phản hồi yêu cầu trong thời hạn hợp lý; log qua `audit_logs`.

Trạng thái code 2026-07-16: RBAC/ownership, PII masking ở admin responses và audit nền đã có; quy trình DSR export/delete/anonymize end-to-end, retention job và encrypted-column decision vẫn là backlog. Không được mô tả các quyền này là đã tự phục vụ hoàn chỉnh trên UI.

## 6. Xóa tài khoản & ẩn danh (không phá vỡ tài chính/audit)

Nguyên tắc: **xóa cứng PII, giữ bản ghi tài chính/pháp lý ở dạng ẩn danh** để tuân thủ kế toán/chống gian lận.

- `users.status = deleted` + soft delete; **ẩn danh PII** (SĐT/email/tên → giá trị băm/ẩn), gỡ liên kết nhận diện.
- **Giữ** `payments`, `refunds`, `legal_consents`, `audit_logs` (bất biến) nhưng thay tham chiếu PII bằng khóa ẩn danh — phục vụ nghĩa vụ kế toán/tranh chấp.
- Dữ liệu học sinh của phụ huynh bị xóa → ẩn danh/gỡ theo dữ liệu phụ huynh.
- Review đã published: cân nhắc giữ nội dung nhưng ẩn danh người viết (đánh giá là tài sản chung của nền tảng) — nêu rõ trong Điều khoản.

## 7. Lưu giữ & dọn dữ liệu (retention)

| Dữ liệu | Chính sách đề xuất |
| --- | --- |
| `otp_requests` | Xóa/ẩn sau khi dùng hoặc hết hạn (vài giờ) |
| `webhook_events`, `outbox_events(done)` | TTL dọn định kỳ (vd 30–90 ngày) |
| `notifications` | Dọn/nén sau vài tháng |
| `audit_logs`, `payments`, `refunds`, `legal_consents` | Giữ lâu theo nghĩa vụ pháp lý/kế toán (append-only) |
| Media chưa duyệt/bị từ chối | Dọn sau thời hạn |
| Tài khoản không hoạt động lâu | Xem xét chính sách ẩn/nhắc |

## 8. Bảo mật dữ liệu khi lưu/truyền (nhắc lại từ `13-...`)

- Mã hóa khi truyền (TLS) bắt buộc.
- Cân nhắc mã hóa cột cho PII cao (số tài khoản, có thể SĐT) nếu rủi ro cao.
- Không log PII/secret; mask ở log/observability.
- Phân quyền truy cập DB tối thiểu; DB không mở public.

## 9. Quy trình khi có vi phạm dữ liệu

- Có quy trình phát hiện → đánh giá phạm vi → thông báo cơ quan/chủ thể theo yêu cầu pháp luật → khắc phục.
- Log/audit đủ để điều tra phạm vi ảnh hưởng.

## 10. Minh bạch với người dùng

- Nêu rõ dữ liệu nào thu, mục đích, lưu bao lâu, chia sẻ với ai (provider thanh toán/SMS/email).
- Dữ liệu tự khai (điểm thi/GPA/trường) phải có disclaimer "do gia sư tự khai báo, chưa được nền tảng xác minh".
- Nút liên hệ/liên hệ trực tiếp chỉ mở theo rule đã chốt; không public liên hệ ở bản xem thử.

## 11. Việc cần chốt với pháp lý (đưa vào open-questions)

- Bản Điều khoản sử dụng & Chính sách bảo mật chính thức (ai soạn, đặt ở đâu, version đầu tiên).
- Có thu IP/user agent trong consent không.
- Độ tuổi và cơ chế xác nhận vai trò giám hộ của phụ huynh.
- Chính sách giữ/ẩn danh review sau khi người viết xóa tài khoản.
- Danh sách bên thứ ba xử lý dữ liệu (payment/SMS/email/storage) để công bố.
