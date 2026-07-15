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
- `08-lovable-ui-prompts.md`: prompt chi tiết để Lovable tạo đúng file HTML/CSS/JS bấm được cho `tutor-market`, `tutor-app`, `tutor-admin`.
- `09-frontend-task-governance.md`: quy ước trạng thái, kiến trúc frontend đề xuất, Definition of Done và thứ tự nhận task UI.
- `10-tutor-app-task-list.md`: task triển khai app gia sư, mỗi task là một commit full-scope.
- `11-tutor-market-task-list.md`: task triển khai app phụ huynh/chợ gia sư, gồm MVP và nhóm màn hậu MVP.
- `12-tutor-admin-task-list.md`: task triển khai console admin và các yêu cầu bảo mật vận hành.
- `13-mock-ui-ux-audit.md`: inventory màn hình, luồng xuyên app, sai lệch mock/API và các đề xuất sửa logic.
- `14-active-work.md`: con trỏ task duy nhất cho AI mới, owner hiện tại, task vừa hoàn tất và hàng đợi toàn dự án.

## Cách dùng

1. Đọc `14-active-work.md` để biết duy nhất task nào được phép nhận tiếp.
2. Đọc `../CLAUDE.md`, `../ai-docs/00-index.md` và các tài liệu được task hiện tại trỏ tới.
3. Kiểm tra câu hỏi trong `04-open-questions.md` và dependency trong task list của app.
4. Làm theo quy trình nhận/hoàn tất task trong `09-frontend-task-governance.md`.
5. Khi hoàn tất task API/hạ tầng, cập nhật `06-verification.md` nếu cách kiểm chứng thay đổi.
6. Không tự chọn task khác với `Current task` trong `14-active-work.md`, kể cả khi thấy một task `TODO` khác có vẻ làm được.
