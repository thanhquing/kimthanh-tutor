# Mục Lục Tài Liệu AI

Thư mục này là bộ tài liệu tham chiếu cho AI/lập trình viên khi xây hệ thống Kim Thanh Tutor.

## Thứ tự đọc khuyến nghị

1. `01-business-flow.md`: luồng nghiệp vụ đã chuẩn hóa.
2. `02-improvements.md`: các điểm cần cải thiện và đã điều chỉnh.
3. `03-product-scope.md`: phạm vi MVP và những gì tạm thời không làm.
4. `04-roles-and-permissions.md`: vai trò, quyền và ranh giới truy cập.
5. `05-domain-model.md`: thực thể, trạng thái và quan hệ dữ liệu.
6. `06-api-contract.md`: nhóm API và quy ước ở mức sản phẩm.
7. `07-payments-and-monetization.md`: gói thu phí, thanh toán, mở khóa và hết hạn.
8. `08-legal-consent-and-privacy.md`: popup bắt buộc, consent và bảo mật dữ liệu.
9. `09-notification-and-state-flows.md`: thông báo và máy trạng thái.
10. `10-acceptance-criteria.md`: tiêu chí nghiệm thu.
11. `11-database-erd.md`: sơ đồ ERD cơ sở dữ liệu và bảng đối chiếu API.
12. `12-non-functional-requirements.md`: hiệu năng, chịu tải, cache, phân trang, SLO.
13. `13-security-and-threat-model.md`: bảo mật, phân quyền, webhook, chống lạm dụng.
14. `14-data-privacy-and-compliance.md`: quyền riêng tư, PDPD (NĐ 13/2023), dữ liệu trẻ em.
15. `15-architecture-and-tech-stack.md`: stack, ranh giới module, quy ước chung, chiến lược chịu tải PA2.

## Tài liệu kỹ thuật nền tảng (đọc trước khi code)

- Quy ước chung (ID/thời gian/tiền/outbox/idempotency): `15`.
- Chịu tải & hiệu năng: `12`.
- Bảo mật: `13`. Pháp lý dữ liệu: `14`.

## Dự án liên quan

- `../tutor-api`: API phía máy chủ.
- `../tutor-market`: ứng dụng phụ huynh.
- `../tutor-app`: ứng dụng gia sư.
- `../tutor-admin`: console vận hành nội bộ cho role `admin`.
- `../packages/contracts`: enum/type/DTO dùng chung giữa API và ba frontend.

`ai-docs` mô tả quyết định và tiêu chí mục tiêu; trạng thái code/test hiện tại được ghi ở `../ai-tasks/14-active-work.md` và `../ai-tasks/06-verification.md`. Không suy ra một feature đã hoàn tất chỉ vì nó xuất hiện trong tài liệu phạm vi.

## Quy ước

- "Ứng dụng phụ huynh" và `tutor-market` là cùng một sản phẩm.
- "Ứng dụng gia sư" và `tutor-app` là cùng một sản phẩm.
- "Hồ sơ bị khóa" nghĩa là phụ huynh thấy bản xem thử nhưng chưa thấy video/đánh giá chi tiết.
- "Gói theo dõi" chỉ mở bảng điều khiển học tập của con, không mở khóa tất cả hồ sơ gia sư.
- "VIP mở khóa hồ sơ" chỉ áp dụng cho việc xem hồ sơ/đánh giá/video trong chợ gia sư.
