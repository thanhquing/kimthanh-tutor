# tutor-market

Ứng dụng phụ huynh: chợ gia sư thông minh và bảng điều khiển theo dõi học tập.

## Phạm vi

- Cho phép khách chưa đăng nhập tìm kiếm gia sư bằng bộ lọc nâng cao.
- Hiển thị thẻ gia sư ở chế độ xem thử miễn phí.
- Hiển thị màn khóa trả phí khi xem video giới thiệu, đánh giá sao và nhận xét chi tiết.
- Hỗ trợ thanh toán mở khóa một hồ sơ hoặc mua VIP tháng.
- Gửi yêu cầu dạy thử đến gia sư.
- Đăng ký/kích hoạt tài khoản sau khi gia sư chấp nhận dạy thử/lớp.
- Hiển thị bảng điều khiển miễn phí có giới hạn và bảng điều khiển chi tiết khi có gói theo dõi.
- Bắt buộc đánh giá sau khi lớp kết thúc trong phạm vi lớp đó.

## Nguyên tắc trải nghiệm người dùng

- Màn hình đầu tiên là danh sách/tìm kiếm gia sư, không làm trang marketing.
- Khách chưa đăng nhập được xem đủ thông tin cần thiết để quyết định có mở khóa hay không.
- Paywall phải nói rõ nội dung nào bị khóa và giá trị của việc mở khóa.
- Bảng điều khiển của phụ huynh cần ưu tiên dòng thời gian, mức độ tiếp thu, bài tập và cảnh báo vấn đề.
- Không hiển thị thông tin liên hệ trực tiếp của gia sư trước khi người dùng đi qua luồng liên hệ/chốt lớp được cho phép.

## Tài liệu nên đọc trước khi code

1. `../ai-docs/01-business-flow.md`
2. `../ai-docs/02-improvements.md`
3. `../ai-docs/03-product-scope.md`
4. `../ai-docs/04-roles-and-permissions.md`
5. `../ai-docs/09-notification-and-state-flows.md`
6. `../ai-docs/10-acceptance-criteria.md`

## Phát triển

`tutor-market` dùng Next.js App Router. Trang tìm kiếm và hồ sơ gia sư là
Server Components có SSR/ISR; các khu vực phụ huynh là shell `noindex,nofollow`
và chỉ được nạp dữ liệu sau auth + consent ở task tương ứng.

```bash
pnpm --filter tutor-market dev
pnpm --filter tutor-market test
pnpm --filter tutor-market lint
pnpm --filter tutor-market build
```

Thiết lập `API_BASE_URL` và `NEXT_PUBLIC_SITE_URL` từ `.env.example`. Không có
UI production để đổi API base hoặc bật mock mode.
