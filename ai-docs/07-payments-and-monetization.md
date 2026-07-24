# Thanh Toán Và Mô Hình Doanh Thu

## Sản phẩm thu phí

Các mức dưới đây là tham khảo sản phẩm, không phải constant frontend. Code hiện đọc `product_pricing` do admin cấu hình và chỉ dùng fallback kỹ thuật khi DB chưa có cấu hình; checkout response là nguồn giá/kỳ hạn cho UI.

### 1. Mở khóa từng hồ sơ

Đối tượng trả tiền:

- Phụ huynh.

Giá tham khảo:

- 30k-50k/hồ sơ.

Giá trị:

- Xem video giới thiệu.
- Xem sao và nhận xét chi tiết.
- Xem thông tin hồ sơ chi tiết được khóa sau màn khóa trả phí.

Quyền truy cập:

- Gắn với một `TutorProfile`.
- **Vĩnh viễn** với hồ sơ đó (`expires_at = null`) — đã chốt.

### 2. VIP mở khóa hồ sơ cho phụ huynh

Đối tượng trả tiền:

- Phụ huynh.

Giá tham khảo:

- 150k/tháng.

Giá trị:

- Mở khóa nhiều hồ sơ trong thời hạn gói.

Không bao gồm:

- Bảng điều khiển theo dõi học tập chi tiết nếu chưa mua gói theo dõi.

### 3. Gói theo dõi học tập cho phụ huynh

Đối tượng trả tiền:

- Phụ huynh có lớp/học sinh được liên kết.

Giá tham khảo:

- 49k-89k/tháng.

Giá trị:

- Xem dòng thời gian sổ đầu bài.
- Xem bài tập về nhà.
- Xem nhận xét chi tiết.
- Xem biểu đồ tăng trưởng theo mức độ tiếp thu.

### 4. Gói QR cho gia sư

Đối tượng trả tiền:

- Gia sư.

Giá tham khảo:

- 30k/tháng.

Giá trị:

- Bật nút tạo QR/link thanh toán.

Không bao gồm:

- Hệ thống không xác nhận tiền học phí đã về ngân hàng.
- Hệ thống không thu hộ và không chuyển tiền cho gia sư.

## Tích hợp thanh toán: VietQR (miễn phí)

Đã chốt dùng **VietQR** (chuẩn NAPAS 247, EMVCo) cho đơn giản và miễn phí. VietQR áp dụng cho **hai dòng tiền khác nhau** — phải tách rõ:

### A. Học phí gia sư (tính năng QR 30k) — tiền vào tài khoản GIA SƯ

- Tạo QR VietQR từ `tutor_payout_accounts` (bank_code + account_number + account_holder) + số tiền + nội dung. `bank_code` phải là BIN NAPAS trong danh mục `PAYOUT_BANK_CATALOG` được server trả về; không nhận alias/mã tùy ý từ client.
- Cách tạo (miễn phí, không phụ thuộc bên thứ ba):
  - Sinh **chuỗi EMVCo VietQR tại máy chủ** rồi render QR ở client, **hoặc**
  - Dùng ảnh QR miễn phí qua `https://img.vietqr.io/image/{BANK}-{ACCOUNT}-{TEMPLATE}.png?amount=...&addInfo=...&accountName=...`.
- **Nền tảng KHÔNG xác nhận dòng tiền** này. Gia sư tự đối chiếu ngân hàng → bấm "Đã thu" (`collection_status = marked_collected`). Không cần webhook.

### B. Doanh thu nền tảng (mở khóa/VIP/theo dõi/gói QR) — tiền vào tài khoản NỀN TẢNG

Cần mở khóa **tự động** ngay sau khi trả. Cách miễn phí + tự động:

- Tạo QR VietQR trỏ vào **tài khoản ngân hàng nền tảng**, kèm **mã đơn duy nhất** trong nội dung chuyển khoản (map vào `payments.provider_reference`, ví dụ `KTT<payment_id_rút_gọn>`).
- Dùng **dịch vụ lắng nghe biến động số dư ngân hàng** (khuyến nghị **SePay** — có gói free; hoặc Casso) làm "provider webhook": khi tiền về khớp mã + số tiền → bắn webhook → hệ thống mở khóa.
- Giữ nguyên thiết kế: `payments.provider = 'sepay'` (hoặc `bank_transfer`), verify webhook (API key/chữ ký) + đối chiếu `amount` + `provider_reference`, chống trùng `webhook_events`, idempotency. Xem `13-security-and-threat-model.md`.
- **Fallback** nếu chưa bật dịch vụ webhook: xác nhận tay theo sao kê chỉ là phương án vận hành thử nghiệm; code hiện chưa có workflow reconciliation hoàn chỉnh và không được tự cấp quyền ngoài audit/policy đã chốt.

> Lưu ý: VietQR trần (chuyển khoản thuần) không có tín hiệu tự động; auto-unlock phụ thuộc dịch vụ webhook ngân hàng ở mục B.

## Trạng thái thanh toán

- `pending`: đã tạo giao dịch, chưa có kết quả.
- `paid`: thanh toán thành công.
- `failed`: thanh toán thất bại.
- `cancelled`: người dùng/cổng thanh toán hủy.
- `refunded`: đã hoàn tiền.

### Gói theo dõi tính theo học sinh

- Mỗi học sinh (con) là một gói `parent_tracking` riêng (`scope_ref_id = student_id`) — đã chốt.
- Kiểm tra quyền dashboard chi tiết = có gói `parent_tracking` active cho **đúng học sinh** đang xem.

## Quy tắc cấp quyền truy cập

- Chỉ cấp quyền khi trạng thái thanh toán = `paid`, sau khi webhook đã **verify chữ ký + đối chiếu số tiền**.
- Cấp quyền chạy trong transaction, có **idempotency** (chống double-submit) và **chống trùng webhook** (`webhook_events`).
- Nếu webhook đến chậm, giao diện nên kiểm tra lặp hoặc gọi API lấy trạng thái thanh toán.
- Nếu thanh toán bị hoàn tiền, ghi `Refund` và thu hồi/hết hạn quyền liên quan theo chính sách.
- Nếu gói định kỳ hết hạn, không xóa dữ liệu, chỉ khóa truy cập chi tiết.
- Tiền lưu số nguyên theo đồng VND (không float); mọi giao dịch bất biến (append-only), truy vết được. Xem `11-database-erd.md`, `13-security-and-threat-model.md`.

## Hướng dẫn nội dung màn khóa trả phí

Paywall cần nói ngắn gọn:

- Nội dung đang bị khóa.
- Giá/chu kỳ.
- Quyền được mở.
- Điều gì không bao gồm.

Ví dụ:

- "Mở khóa hồ sơ để xem video giới thiệu và nhận xét từ phụ huynh đã học."
- "Gói theo dõi chỉ áp dụng cho bảng điều khiển học tập của con, không bao gồm mở khóa hồ sơ gia sư khác."
- "Tính năng QR chỉ tạo mã/link thanh toán. Gia sư tự đối chiếu giao dịch với ngân hàng."
