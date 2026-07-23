# Active Work — Con Trỏ Công Việc Cho AI

File này trả lời duy nhất câu hỏi: **AI mới phải làm task nào tiếp theo?**

Không dùng file này thay cho full scope. Sau khi lấy ID tại đây, phải đọc task tương ứng trong `10-tutor-app-task-list.md`, `11-tutor-market-task-list.md` hoặc `12-tutor-admin-task-list.md`, cùng quy tắc tại `09-frontend-task-governance.md`.

## Current task

| Field | Value |
| --- | --- |
| Task | `TA-08` |
| App | `tutor-app` |
| Title | Tài khoản nhận học phí |
| Source | `ai-tasks/10-tutor-app-task-list.md` |
| Status | `TODO` |
| Owner | — |
| Started | — |
| Branch/worktree | `main` |
| Blocker | — |

Lệnh cho AI mới: nhận đúng `TA-08`; không tự chuyển sang task khác.

## Last completed

| Field | Value |
| --- | --- |
| Task | `TA-07` — Tạo, xem và sửa sổ đầu bài |
| Commit | Tra bằng `git log --oneline --grep='TA-07' -1` |
| Evidence | Class-scoped route `/classes/:id/lesson-logs`; list keyset + create/update cache; POST không gửi `class_id`; edit theo capability/error server; copy note chia sẻ với phụ huynh. Contracts pass; API lint/build + 18 suite/135 test pass; app lint/build + 25 file/125 test pass; Docker Flow 6/7 pass; Playwright tutor-app smoke 3 pass/1 OAuth skip, bao phủ list/create/edit sổ đầu bài. Checklist scope xanh: A01/A04/A09/API1/API3/API4/API5/C3/D5/D7/D8/E1/E3/E7. |

## Global queue

Queue là thứ tự điều phối mặc định. `Current task` vẫn có quyền ưu tiên cao hơn bảng này. Khi hoàn tất một task, chọn dòng kế tiếp có mọi dependency `DONE`.

| Order | Task | App | Dependency | Release |
| ---: | --- | --- | --- | --- |
| 1 | `TA-00` | tutor-app | — | MVP |
| 2 | `TM-00` | tutor-market | — | MVP |
| 3 | `AD-00` | tutor-admin | — | MVP |
| 4 | `TA-01` | tutor-app | TA-00 | MVP |
| 5 | `TA-02` | tutor-app | TA-01 | MVP |
| 6 | `TA-03` | tutor-app | TA-01 | MVP |
| 7 | `TA-04` | tutor-app | TA-02, TA-03 | MVP |
| 8 | `TA-05` | tutor-app | TA-01 | MVP |
| 9 | `TA-06` | tutor-app | TA-05 | MVP |
| 10 | `TA-07` | tutor-app | TA-06 | MVP |
| 11 | `TA-08` | tutor-app | TA-01 | MVP |
| 12 | `TA-09` | tutor-app | TA-01 | MVP |
| 13 | `TA-10` | tutor-app | TA-06, TA-08, TA-09 | MVP |
| 14 | `TA-11` | tutor-app | TA-06 | MVP |
| 15 | `TA-12` | tutor-app | TA-01 | MVP |
| 16 | `TM-01` | tutor-market | TM-00 | MVP |
| 17 | `TM-02` | tutor-market | TM-01 | MVP |
| 18 | `TM-03` | tutor-market | TM-00 | MVP |
| 19 | `TM-04` | tutor-market | TM-03 | MVP |
| 20 | `TM-05` | tutor-market | TM-02, TM-03, TM-04 | MVP |
| 21 | `TM-06` | tutor-market | TM-03, TM-05 | MVP |
| 22 | `TM-07` | tutor-market | TM-04, TM-06 | MVP |
| 23 | `TM-08` | tutor-market | TM-03, TM-04 | MVP |
| 24 | `TM-09` | tutor-market | TM-06, TM-08 | MVP |
| 25 | `AD-01` | tutor-admin | AD-00 | MVP |
| 26 | `AD-02` | tutor-admin | AD-00 | MVP |
| 27 | `AD-03` | tutor-admin | AD-02 | MVP |
| 28 | `AD-04` | tutor-admin | AD-00 | MVP |
| 29 | `AD-05` | tutor-admin | AD-00 | MVP |
| 30 | `AD-06` | tutor-admin | AD-00 | MVP |
| 31 | `AD-07` | tutor-admin | AD-00 | MVP |
| 32 | `AD-08` | tutor-admin | AD-01, AD-04, AD-05, AD-06 | MVP, cần chốt giữ màn |
| 33 | `TA-13` | tutor-app | TA-02–TA-12 | MVP hardening |
| 34 | `TM-10` | tutor-market | TM-01–TM-09 | MVP hardening |
| 35 | `AD-09` | tutor-admin | AD-01–AD-08 | MVP hardening |
| 36 | `TM-11` | tutor-market | TM-02 | Hậu MVP, cần explicit approval |
| 37 | `TM-12` | tutor-market | TM-06 | Hậu MVP, cần explicit approval |
| 38 | `TM-13` | tutor-market | TM-03, TM-08 | Hậu MVP, cần tách task con và explicit approval |
| 39 | `INFRA-01` | tutor-api | — | Hạ tầng, cuối hàng đợi, cần explicit approval |
| 40 | `INFRA-02` | tutor-api | INFRA-01 | Hạ tầng, cuối hàng đợi, cần explicit approval |
| 41 | `INFRA-03` | tutor-api | INFRA-01 | Hạ tầng, cuối hàng đợi, cần explicit approval |
| 42 | `INFRA-04` | tutor-api | INFRA-01 | Hạ tầng, cuối hàng đợi, cần explicit approval |
| 43 | `INFRA-05` | tutor-api | — | Hạ tầng, cuối hàng đợi, cần explicit approval |
| 44 | `INFRA-06` | tutor-api | — | Hạ tầng, cuối hàng đợi, cần explicit approval |
| 45 | `INFRA-07` | tutor-api | — | Hạ tầng, cuối hàng đợi, cần explicit approval |
| 46 | `INFRA-08` | tutor-api | — | Hạ tầng, cuối hàng đợi, cần explicit approval |

Chi tiết phạm vi INFRA-01..08: `01-backlog.md` §Nhóm việc 10; hạng mục checklist tương ứng: `15-perf-security-checklist.md`.

## Protocol nhận task

AI bắt đầu làm phải thực hiện theo thứ tự:

1. Xác nhận `Current task` chưa `DONE` và không có owner khác.
2. Đọc full task, dependencies, audit IDs, open questions và tài liệu kỹ thuật bắt buộc.
3. Kiểm tra `git status` và baseline tests.
4. Đổi `Status`/`Owner`/`Started` ở đây và task list sang `INPROGRESS` trong working tree.
5. Hoàn thành đúng full scope; không làm task tiếp theo.

## Protocol hoàn tất task

Trong cùng commit full-scope của task:

1. Đổi task trong task list sang `DONE`, ghi owner, ngày và evidence.
2. Cập nhật cột app tương ứng trong `15-perf-security-checklist.md`: mọi hạng mục performance/bảo mật task chạm tới phải 🟢 kèm evidence trước khi `DONE` (cổng bắt buộc theo `09` §4).
3. Cập nhật `Last completed` bằng task ID. Commit subject phải chứa ID để tra bằng `git log --grep='<TASK-ID>'`.
4. Chuyển `Current task` sang dòng queue kế tiếp đủ dependency, đặt `TODO`, xóa owner/start/blocker.
5. Chạy toàn bộ verification trong task và kiểm tra staged diff chỉ thuộc scope.
6. Commit một lần theo mẫu `feat(<app>): <TASK-ID> <mô tả>`.

Nếu không thể hoàn tất vì blocker cần quyết định hoặc quyền mới, giữ `INPROGRESS`, ghi blocker cụ thể và báo người điều phối; không tự lấy task khác.

## Prompt tối thiểu cho AI mới

```text
Đọc CLAUDE.md và ai-tasks/14-active-work.md. Nhận đúng Current task,
cập nhật trạng thái theo ai-tasks/09-frontend-task-governance.md, thực hiện
toàn bộ full scope, test và cURL của task. Chỉ tạo một commit chứa TASK-ID;
không làm task kế tiếp. Khi xong, cập nhật Current task sang queue kế tiếp.
```
