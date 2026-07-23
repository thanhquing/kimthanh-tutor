import type { ClassDetail, LessonLogDetail } from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { classesApi } from "../lib/api/classes";
import { ApiClientError } from "../lib/api/errors";
import { lessonLogsApi } from "../lib/api/lesson-logs";
import { LessonLogsPage } from "./LessonLogsPage";

function classItem(): ClassDetail {
  return {
    id: "class-1", trial_request_id: "trial-1", parent_profile_id: "parent-1", student_id: "student-1", tutor_profile_id: "tutor-1",
    subject: "Toán lớp 8", status: "active", version: 1, started_at: "2026-07-01T00:00:00.000Z", ended_at: null,
    created_at: "2026-06-20T00:00:00.000Z", updated_at: "2026-07-19T00:00:00.000Z", parent: { id: "parent-1", display_name: "Anh Minh" },
    student: { id: "student-1", name: "Minh Châu", grade: "8" }, requested_teaching_mode: "online", requested_schedule: null,
    capabilities: { transitions: ["paused", "completed_pending_review", "cancelled"], can_create_lesson_log: true, can_view_review: false },
  };
}

function log(id: string, canEdit = true): LessonLogDetail {
  return {
    id, class_contract_id: "class-1", tutor_profile_id: "tutor-1", lesson_at: "2026-07-19T12:30:00.000Z",
    subject: id === "lesson-1" ? "Phân số" : "Hình học", content: "Nội dung cũ", homework: null,
    absorption_level: "needs_review", tutor_note: "Cần ôn lại", created_at: "2026-07-19T12:30:00.000Z",
    updated_at: "2026-07-19T12:30:00.000Z", capabilities: { can_edit: canEdit, edit_until: "2026-07-26T12:30:00.000Z" },
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/classes/class-1/lesson-logs"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/classes/:id/lesson-logs" element={<LessonLogsPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe("LessonLogsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(classesApi, "detail").mockResolvedValue(classItem());
  });

  it("renders canonical levels and uses the server edit capability", async () => {
    const list = vi.spyOn(lessonLogsApi, "list").mockResolvedValue({ items: [log("lesson-1"), log("lesson-2", false)], next_cursor: null });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Sổ đầu bài · Toán lớp 8" })).toBeInTheDocument();
    expect(screen.getAllByText("Cần ôn lại")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Sửa buổi học" })).toHaveLength(1);
    expect(screen.getByText("Đã hết thời hạn chỉnh sửa")).toBeInTheDocument();
    expect(screen.getAllByText("Nhận xét chia sẻ với phụ huynh")).toHaveLength(2);
    expect(screen.queryByText(/ghi chú riêng/i)).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledWith("class-1", { cursor: undefined, limit: 20 });
  });

  it("validates and creates a timezone-safe lesson without class_id in the body", async () => {
    const user = userEvent.setup();
    const created = { ...log("lesson-new"), subject: "Hình học", content: "Tam giác", absorption_level: "good" as const };
    vi.spyOn(lessonLogsApi, "list")
      .mockResolvedValueOnce({ items: [], next_cursor: null })
      .mockResolvedValue({ items: [created], next_cursor: null });
    const create = vi.spyOn(lessonLogsApi, "create").mockResolvedValue(created);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Ghi buổi học" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Lưu buổi học" }));
    expect(within(dialog).getByText("Vui lòng nhập môn/chủ đề buổi học.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Ngày giờ học/), { target: { value: "2026-07-19T19:30" } });
    await user.type(within(dialog).getByLabelText(/^Môn\/chủ đề/), "  Hình học  ");
    await user.type(within(dialog).getByLabelText(/^Nội dung đã học/), "  Tam giác  ");
    await user.selectOptions(within(dialog).getByLabelText(/^Mức độ tiếp thu/), "good");
    await user.type(within(dialog).getByLabelText(/^Nhận xét chia sẻ với phụ huynh/), "  Tiếp thu tốt  ");
    await user.click(within(dialog).getByRole("button", { name: "Lưu buổi học" }));

    expect(create).toHaveBeenCalledTimes(1);
    const [classId, body] = create.mock.calls[0];
    expect(classId).toBe("class-1");
    expect(body).toMatchObject({ subject: "Hình học", content: "Tam giác", absorption_level: "good", tutor_note: "Tiếp thu tốt" });
    expect(body).not.toHaveProperty("class_id");
    expect(new Date(body.lesson_at as string).toISOString()).toBe(body.lesson_at);
    expect(await screen.findByRole("heading", { name: "Hình học" })).toBeInTheDocument();
  });

  it("can clear optional fields while editing and updates the visible cache", async () => {
    const user = userEvent.setup();
    const updated = { ...log("lesson-1"), subject: "Đại số", content: null, tutor_note: null };
    vi.spyOn(lessonLogsApi, "list")
      .mockResolvedValueOnce({ items: [log("lesson-1")], next_cursor: null })
      .mockResolvedValue({ items: [updated], next_cursor: null });
    const update = vi.spyOn(lessonLogsApi, "update").mockResolvedValue(updated);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Sửa buổi học" }));
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText(/^Môn\/chủ đề/));
    await user.type(within(dialog).getByLabelText(/^Môn\/chủ đề/), " Đại số ");
    await user.clear(within(dialog).getByLabelText(/^Nội dung đã học/));
    await user.clear(within(dialog).getByLabelText(/^Nhận xét chia sẻ với phụ huynh/));
    await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    expect(update).toHaveBeenCalledWith("lesson-1", expect.objectContaining({ subject: "Đại số", content: "", tutor_note: "" }));
    expect(await screen.findByRole("heading", { name: "Đại số" })).toBeInTheDocument();
    expect(screen.getByText("Chưa ghi nội dung")).toBeInTheDocument();
  });

  it("shows the server edit-window error instead of predicting it in the client", async () => {
    const user = userEvent.setup();
    vi.spyOn(lessonLogsApi, "list").mockResolvedValue({ items: [log("lesson-1")], next_cursor: null });
    vi.spyOn(lessonLogsApi, "update").mockRejectedValue(new ApiClientError("Chỉ được sửa sổ buổi học trong 7 ngày", "api", 409, "INVALID_STATE_TRANSITION"));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Sửa buổi học" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Lưu thay đổi" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("Chỉ được sửa sổ buổi học trong 7 ngày");
  });
});
