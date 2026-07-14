# Các Điểm Cần Cải Thiện Và Điều Chỉnh

Tài liệu này liệt kê các điểm luồng nghiệp vụ gốc nên cải thiện và cách điều chỉnh cho giai đoạn 1.

## 1. Cần tách rõ các sản phẩm trả phí của phụ huynh

Vấn đề:

- Mở khóa hồ sơ và bảng điều khiển theo dõi là hai giá trị khác nhau.
- Nếu gộp chung sẽ gây nhầm lẫn khi định giá, màn khóa trả phí, hoàn tiền và CSKH.

Điều chỉnh:

- `ProfileUnlock`: mở một hồ sơ cụ thể.
- `parent_vip_unlock`: mở nhiều hồ sơ trong thời hạn tháng.
- `parent_tracking`: xem bảng điều khiển học tập chi tiết của con.

## 2. Cần có máy trạng thái cho yêu cầu/lớp học

Vấn đề:

- Luồng gốc nói "chấp nhận lớp", "đăng ký", "kết thúc hợp đồng" nhưng chưa có trạng thái trung gian.

Điều chỉnh:

- `TrialRequest`: pending, accepted, declined, expired, cancelled.
- `ClassContract`: trial_accepted, active, paused, completed_pending_review, completed, cancelled.
- Mỗi trạng thái cần có actor được phép chuyển trạng thái.

## 3. Đánh giá cần được bảo vệ

Vấn đề:

- Đánh giá là tài sản được dùng trong màn khóa trả phí, nên cần tránh đánh giá ảo, spam và đánh giá độc hại.

Điều chỉnh:

- Chỉ phụ huynh có lớp đã hoàn tất mới được đánh giá.
- Mỗi lớp chỉ có một đánh giá chính, có thể cho sửa trong thời gian giới hạn.
- Đánh giá có trạng thái: pending_moderation, published, hidden, disputed.
- Gia sư có quyền báo cáo đánh giá.

## 4. Hồ sơ gia sư cần có trạng thái đủ điều kiện lên chợ

Vấn đề:

- Nếu gia sư đăng ký nhưng thiếu ảnh/môn/học phí, chợ gia sư sẽ bị loãng và khó lọc.

Điều chỉnh:

- Thêm `TutorProfileStatus`: draft, publishable, published, hidden, suspended.
- `publishable` cần tối thiểu: họ tên, ảnh/placeholder hợp lệ, môn, khối, hình thức, học phí, khu vực nếu offline.

## 5. Bộ lọc nâng cao cần cân bằng giữa hữu ích và riêng tư

Vấn đề:

- Điểm thi/GPA, trường, giới tính, giọng nói là dữ liệu nhạy cảm hoặc dễ bị lạm dụng nếu bắt buộc.

Điều chỉnh:

- Các trường này nên là tự khai báo và có thể ẩn/hiện có kiểm soát.
- Không yêu cầu CCCD giai đoạn 1.
- Nên có disclaimer "thông tin do gia sư tự khai báo" nếu chưa có quy trình xác minh.

## 6. Cần rõ thời hạn mở khóa

Vấn đề:

- Flow gốc chưa nói mở khóa từng hồ sơ có hiệu lực bao lâu.

Điều chỉnh đề xuất:

- Mở khóa từng hồ sơ: xem trọn đời với hồ sơ đó, hoặc tối thiểu 30 ngày. Cần chốt trước khi code.
- VIP: theo chu kỳ tháng.
- Gói theo dõi bảng điều khiển: theo chu kỳ tháng, hết hạn thì khóa chi tiết nhưng giữ dữ liệu.

Mặc định tài liệu giai đoạn 1 dùng quy ước:

- `ProfileUnlock` có `expires_at` tùy chính sách giá quyết định.
- Nếu `expires_at = null` thì mở khóa vĩnh viễn cho hồ sơ đó.

## 7. Cần luồng thanh toán thất bại/hủy/hoàn tiền

Vấn đề:

- Flow gốc chỉ nói thanh toán thành công.

Điều chỉnh:

- Mỗi thanh toán cần có trạng thái: pending, paid, failed, cancelled, refunded.
- Mở khóa/gói định kỳ chỉ kích hoạt khi thanh toán = paid.
- Hoàn tiền nếu có sẽ khóa lại quyền truy cập liên quan tùy chính sách.

## 8. Cần nói rõ liên hệ trực tiếp

Vấn đề:

- Nếu sau khi mở khóa hồ sơ đã hiện thông tin liên hệ trực tiếp, nền tảng có thể bị bypass.

Điều chỉnh:

- Giai đoạn 1 nên ưu tiên nút "Gửi yêu cầu dạy thử".
- Chỉ chia sẻ liên hệ theo rule đã chốt, ví dụ sau khi gia sư chấp nhận hoặc sau khi phụ huynh đã đăng ký.

## 9. Popup pháp lý cần lưu version

Vấn đề:

- "Đã cuộn 100%" là trải nghiệm người dùng chuẩn, nhưng cần kiểm toán được người dùng đồng ý bản nào.

Điều chỉnh:

- Lưu `terms_version`, `privacy_version`, `accepted_at`, `consent_method`, `scroll_reached_bottom`.
- Khi có version mới, có thể bắt đồng ý lại.

## 10. Cần giới hạn việc bắt buộc đánh giá

Vấn đề:

- "Bắt buộc đánh giá" có thể làm người dùng khó chịu nếu chặn toàn bộ ứng dụng.

Điều chỉnh:

- Bắt buộc đánh giá trong ngữ cảnh lớp đã kết thúc.
- Cho phép "nhắc lại sau" một số lần nếu cần.
- Sau giới hạn, chặn các hành động liên quan lớp đó cho tới khi đánh giá.

## 11. Cần kiểm duyệt video và nội dung hồ sơ

Vấn đề:

- Video giới thiệu và mô tả có thể chứa nội dung liên hệ trực tiếp hoặc nội dung không phù hợp.

Điều chỉnh:

- Hồ sơ/video có trạng thái kiểm duyệt.
- Phát hiện số điện thoại/email/link ngoài trong mô tả hoặc bản chép lời video nếu có.

## 12. Cần phân biệt tài khoản và vai trò

Vấn đề:

- Một người có thể vừa là phụ huynh vừa là gia sư trong tương lai.

Điều chỉnh:

- Domain nên có `User` chung và `ParentProfile`/`TutorProfile` riêng.
- Giai đoạn 1 giao diện có thể tách ứng dụng nhưng phía máy chủ nên sẵn sàng cho nhiều vai trò.

---

## Phần B — Cải Thiện Kỹ Thuật (Vòng Refactor "Chịu Tải/Bảo Mật")

Các điểm dưới đây bổ sung tầng kỹ thuật cho bản thiết kế, để đạt yêu cầu best practice + performance + security + chịu tải lớn. Chi tiết ở `11`–`15`.

## 13. Guest gửi yêu cầu dạy thử không có chỗ chứa

- Vấn đề: flow cho guest gửi request nhưng `TrialRequest` cần `parent_profile_id` → phễu gãy.
- Điều chỉnh: thêm thực thể `Lead`; `TrialRequest` gắn `lead_id` hoặc `parent_profile_id` (đúng một trong hai). Xem `05`, `11`.

## 14. Tìm kiếm không chịu được tải với chuỗi CSV

- Vấn đề: `subjects/grade_levels/teaching_modes/offline_areas` lưu chuỗi → không index/lọc hiệu quả (full scan).
- Điều chỉnh: chuẩn hóa thành bảng con + index; đọc qua `SearchPort` (adapter Postgres mặc định); GIN trigram/`tsvector` và Meilisearch là nâng cấp theo ngưỡng. Xem `11`, `12`.

## 15. Điểm đánh giá tính runtime gây chậm

- Vấn đề: AGG `reviews` mỗi thẻ mỗi lần search = tự sát ở tải cao.
- Điều chỉnh: denormalize `rating_avg`, `rating_count` trên `tutor_profiles`, cập nhật khi review published.

## 16. Webhook thanh toán thiếu bảo mật

- Vấn đề: chỉ chống trùng, không verify chữ ký/số tiền → dễ bị giả mạo mở khóa miễn phí.
- Điều chỉnh: verify HMAC/chữ ký + đối chiếu số tiền + chống trùng (`webhook_events`) + idempotency + transaction. Xem `13`.

## 17. Thiếu tin cậy cho side-effect

- Vấn đề: thông báo/đồng bộ gọi trực tiếp trong request → mất sự kiện khi lỗi, chậm request.
- Điều chỉnh: Outbox pattern + worker (BullMQ), at-least-once, retry/dead-letter. Xem `12`, `15`.

## 18. Thiếu kiểm soát tương tranh

- Vấn đề: double-accept yêu cầu, race webhook.
- Điều chỉnh: cột `version` optimistic lock cho `trial_requests`/`class_contracts`/`subscriptions`/`payments`; transaction.

## 19. Rủi ro pháp lý dữ liệu trẻ em & PDPD

- Vấn đề: dữ liệu học sinh (trẻ vị thành niên) + PII không có phân loại/consent/retention; chưa nhắc Nghị định 13/2023/NĐ-CP.
- Điều chỉnh: doc `14-data-privacy-and-compliance.md` (phân loại PII, consent giám hộ, retention, ẩn danh khi xóa).

## 20. Thiếu chống lạm dụng OTP/scraping/đi vòng nền tảng

- Vấn đề: chỉ có mã lỗi `RATE_LIMITED`, không chính sách; nguy cơ mất doanh thu do đi vòng nền tảng.
- Điều chỉnh: rate limit đa tầng, OTP hash + cooldown, ẩn liên hệ + phát hiện liên hệ ngoài + signed URL. Xem `13`.

## 21. Thiếu bảng vận hành/tài chính & quy ước dữ liệu

- Điều chỉnh: thêm `refunds`, `idempotency_keys`, `webhook_events`, `outbox_events`, `audit_logs`, `legal_documents`, `tutor_payout_accounts`, `media_assets`, `review_edits`, `otp_requests`; quy ước ULID/UTC/tiền-nguyên/soft delete/enum-CHECK. Xem `11`, `15`.
