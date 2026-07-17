# Active Work — Con Trỏ Công Việc Cho AI

File này trả lời duy nhất câu hỏi: **AI mới phải làm task nào tiếp theo?**

Không dùng file này thay cho full scope. Sau khi lấy ID tại đây, phải đọc task tương ứng trong `10-tutor-app-task-list.md`, `11-tutor-market-task-list.md` hoặc `12-tutor-admin-task-list.md`, cùng quy tắc tại `09-frontend-task-governance.md`.

## Current task

| Field | Value |
| --- | --- |
| Task | `TA-02` |
| App | `tutor-app` |
| Title | Hồ sơ gia sư, media và publish |
| Source | `ai-tasks/10-tutor-app-task-list.md` |
| Status | `TODO` |
| Owner | — |
| Started | — |
| Branch/worktree | — |
| Blocker | — |

Lệnh cho AI mới: nhận đúng `TA-02`; không tự chuyển sang task khác.

## Last completed

| Field | Value |
| --- | --- |
| Task | `TA-01` — Auth, role tutor và legal consent gate |
| Commit | Tra bằng `git log --oneline --grep='TA-01' -1` |
| Evidence | 29 unit/integration test `tutor-app` pass (OAuth mapper, OTP two-step/sai mã, open-redirect allowlist, pending consent, wrong role, suspended, đổi version, scroll gate); tutor-app lint/test/build + contracts serialization pass; backend `auth.controller` 6 tests (logout revoke) pass; `verify-flow-01-auth-consent.sh` pass end-to-end trên Docker cô lập (`kt-ta01-flow01`, đã dọn sạch): OTP → reject consent khi chưa scroll (`400`) → consent → `/auth/me` active → logout `204` → refresh cũ `401`; deep-link `/login` `/consent` `/profile` `/dashboard` trả `200` qua vite preview; Browser visual skill không khả dụng trong phiên nên phủ bằng tests + HTTP smoke |

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
2. Cập nhật `Last completed` bằng task ID. Commit subject phải chứa ID để tra bằng `git log --grep='<TASK-ID>'`.
3. Chuyển `Current task` sang dòng queue kế tiếp đủ dependency, đặt `TODO`, xóa owner/start/blocker.
4. Chạy toàn bộ verification trong task và kiểm tra staged diff chỉ thuộc scope.
5. Commit một lần theo mẫu `feat(<app>): <TASK-ID> <mô tả>`.

Nếu không thể hoàn tất vì blocker cần quyết định hoặc quyền mới, giữ `INPROGRESS`, ghi blocker cụ thể và báo người điều phối; không tự lấy task khác.

## Prompt tối thiểu cho AI mới

```text
Đọc CLAUDE.md và ai-tasks/14-active-work.md. Nhận đúng Current task,
cập nhật trạng thái theo ai-tasks/09-frontend-task-governance.md, thực hiện
toàn bộ full scope, test và cURL của task. Chỉ tạo một commit chứa TASK-ID;
không làm task kế tiếp. Khi xong, cập nhật Current task sang queue kế tiếp.
```
