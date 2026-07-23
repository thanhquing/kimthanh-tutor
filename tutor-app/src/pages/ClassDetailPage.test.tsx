import type { ClassDetail } from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { classesApi } from "../lib/api/classes";
import { ApiClientError } from "../lib/api/errors";
import { ClassDetailPage } from "./ClassDetailPage";

function classItem(): ClassDetail {
  return {
    id: "class-active", trial_request_id: "trial-1", parent_profile_id: "parent-1", student_id: "student-1", tutor_profile_id: "tutor-1",
    subject: "Toán lớp 9", status: "active", version: 2, started_at: "2026-07-01T01:00:00Z", ended_at: null,
    created_at: "2026-06-01T01:00:00Z", updated_at: "2026-07-19T01:00:00Z", parent: { id: "parent-1", display_name: "Anh Minh" },
    student: { id: "student-1", name: "Minh Châu", grade: "9" }, requested_teaching_mode: "online", requested_schedule: "Thứ 2, 4 sau 19:00",
    capabilities: { transitions: ["paused", "completed_pending_review", "cancelled"], can_create_lesson_log: true, can_view_review: false },
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/classes/class-active"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/classes/:id" element={<ClassDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe("ClassDetailPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders relation summary, domain caveat and capability-gated links", async () => {
    vi.spyOn(classesApi, "detail").mockResolvedValue(classItem());
    renderPage();
    expect(await screen.findByRole("heading", { name: "Toán lớp 9" })).toBeInTheDocument();
    expect(screen.getByText("Anh Minh")).toBeInTheDocument();
    expect(screen.getByText(/không phải lịch hợp đồng đã xác nhận/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở sổ đầu bài" })).toHaveAttribute("href", "/classes/class-active/lesson-logs");
    expect(screen.queryByRole("link", { name: "Xem đánh giá" })).not.toBeInTheDocument();
  });

  it("confirms destructive transition and sends the expected version", async () => {
    const user = userEvent.setup();
    const active = classItem();
    vi.spyOn(classesApi, "detail").mockResolvedValue(active);
    const transition = vi.spyOn(classesApi, "transition").mockResolvedValue({ ...active, status: "paused", version: 3, capabilities: { ...active.capabilities, transitions: ["active", "cancelled"] } });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Tạm dừng lớp" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Tạm dừng" }));
    expect(transition).toHaveBeenCalledWith(active.id, { to: "paused", expected_version: 2 });
    expect(await screen.findByText("Tạm dừng")).toBeInTheDocument();
  });

  it("applies current server state on a concurrent transition conflict", async () => {
    const user = userEvent.setup();
    const active = classItem();
    const cancelled: ClassDetail = { ...active, status: "cancelled", version: 3, capabilities: { transitions: [], can_create_lesson_log: false, can_view_review: false } };
    vi.spyOn(classesApi, "detail").mockResolvedValue(active);
    vi.spyOn(classesApi, "transition").mockRejectedValue(new ApiClientError("conflict", "api", 409, "CONFLICT", { class_contract: cancelled }));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Hủy lớp" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy lớp" }));
    expect(await screen.findByText(/Đã hủy.*thao tác khác/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hủy lớp" })).not.toBeInTheDocument();
  });
});
