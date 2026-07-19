import type { AuthMeResponse, ClassDetail, ClassStatus } from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { classesApi } from "../lib/api/classes";
import { ClassesPage } from "./ClassesPage";

const me: AuthMeResponse = { user: { id: "user", phone: null, email: "t@example.test", status: "active" }, roles: ["tutor"], profiles: { parent: null, tutor: { id: "tutor-1" } } };
vi.mock("../app/AuthContext", () => ({ useAuth: () => ({ me }) }));

export function classItem(status: ClassStatus = "active", overrides: Partial<ClassDetail> = {}): ClassDetail {
  return {
    id: `class-${status}`, trial_request_id: "trial-1", parent_profile_id: "parent-1", student_id: "student-1", tutor_profile_id: "tutor-1",
    subject: status === "active" ? "Toán lớp 9" : "Ngữ văn", status, version: 2, started_at: "2026-07-01T01:00:00Z", ended_at: null,
    created_at: "2026-06-01T01:00:00Z", updated_at: "2026-07-19T01:00:00Z", parent: { id: "parent-1", display_name: "Anh Minh" },
    student: { id: "student-1", name: "Minh Châu", grade: "9" }, requested_teaching_mode: "online", requested_schedule: "Thứ 2, 4 sau 19:00",
    capabilities: { transitions: status === "active" ? ["paused", "completed_pending_review", "cancelled"] : [], can_create_lesson_log: status === "active", can_view_review: status === "completed" },
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ClassesPage /></MemoryRouter></QueryClientProvider>);
}

describe("ClassesPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("groups canonical states and links directly to owner-safe detail", async () => {
    vi.spyOn(classesApi, "mine").mockResolvedValue({ items: [classItem(), classItem("completed")], next_cursor: null });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Đang phụ trách" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Đã kết thúc" })).toBeInTheDocument();
    expect(screen.getByText("Đang học")).toBeInTheDocument();
    expect(screen.getByText("Đã hoàn tất")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở lớp Toán lớp 9" })).toHaveAttribute("href", "/classes/class-active");
  });
});
