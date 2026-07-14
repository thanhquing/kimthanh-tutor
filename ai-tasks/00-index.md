# Mục Lục Công Việc AI

Thư mục này dùng để tách việc cho AI/dev sau khi đã chốt tài liệu nghiệp vụ.

## Các file

- `01-backlog.md`: backlog sản phẩm theo nhóm việc.
- `02-milestones.md`: lộ trình thực hiện đề xuất.
- `03-ai-working-rules.md`: quy tắc cho AI/dev khi bắt đầu code.
- `04-open-questions.md`: câu hỏi cần chốt trước khi triển khai.
- `05-api-endpoints.md`: catalog endpoint API (I/O, quyền, quan hệ, thứ tự thực thi) — đã scaffold trong `tutor-api`.
- `06-verification.md`: checklist verify API/schema/database/cURL và quy tắc cập nhật docs sau mỗi task.
- `07-api-curl-user-flows.md`: kịch bản test luồng API bằng cURL theo hành động thật trên từng màn hình, làm đầu vào dựng mock UI/UX.

## Cách dùng

1. Đọc `../ai-docs/00-index.md`.
2. Chốt các câu hỏi trong `04-open-questions.md`.
3. Chọn mốc triển khai trong `02-milestones.md`.
4. Lấy task từ `01-backlog.md`.
5. Khi code, cập nhật task đã làm và tham chiếu file tài liệu liên quan.
6. Khi hoàn tất task API/hạ tầng, cập nhật `06-verification.md` nếu cách kiểm chứng thay đổi.
