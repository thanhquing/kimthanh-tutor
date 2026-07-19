import type {
  AuthMeResponse,
  KeysetPage,
  TrialAcceptResponse,
  TrialRequestSummary,
  TrialStatus,
} from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../lib/api/errors";
import { trialsApi } from "../lib/api/trials";
import { TrialsPage } from "./TrialsPage";

const me: AuthMeResponse = {
  user: { id: "user-1", phone: null, email: "tutor@example.test", status: "active" },
  roles: ["tutor"],
  profiles: { parent: null, tutor: { id: "tutor-1" } },
};

vi.mock("../app/AuthContext", () => ({ useAuth: () => ({ me }) }));

function trial(status: TrialStatus = "pending", overrides: Partial<TrialRequestSummary> = {}): TrialRequestSummary {
  return {
    id: `trial-${status}`,
    parent_profile_id: "parent-1",
    lead_id: null,
    student_id: "student-1",
    tutor_profile_id: "tutor-1",
    subject: status === "pending" ? "Toán lớp 8" : "Ngữ văn",
    grade: "8",
    learning_goal: "Củng cố kiến thức học kỳ",
    teaching_mode: "online",
    preferred_schedule: "Thứ 3, Thứ 5 sau 19:00",
    message: "Mong cô hỗ trợ phần đại số.",
    decline_reason: null,
    status,
    version: status === "pending" ? 0 : 1,
    created_at: "2026-07-19T01:00:00.000Z",
    responded_at: status === "pending" ? null : "2026-07-19T02:00:00.000Z",
    expires_at: "2026-08-02T01:00:00.000Z",
    class_contract_id: status === "accepted" ? "class-1" : null,
    contact: null,
    capabilities: {
      can_accept: status === "pending",
      can_decline: status === "pending",
      can_view_contact: false,
    },
    activation: {
      state: status === "accepted" ? "not_required" : "not_applicable",
      expires_at: null,
    },
    ...overrides,
  };
}

function page(items: TrialRequestSummary[]): KeysetPage<TrialRequestSummary> {
  return { items, next_cursor: null };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TrialsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TrialsPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders safe detail, manual schedule warning, and actions only for pending", async () => {
    vi.spyOn(trialsApi, "mine").mockResolvedValue(page([trial(), trial("accepted")]));
    renderPage();

    expect(await screen.findByRole("heading", { name: "Toán lớp 8" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nhận dạy thử" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nhận dạy thử" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Mở lớp/ })).toHaveAttribute("href", "/classes/class-1");

    const pendingCard = screen.getByRole("heading", { name: "Toán lớp 8" }).closest("article")!;
    await userEvent.click(within(pendingCard).getByText("Xem chi tiết yêu cầu"));
    expect(within(pendingCard).getByText(/chưa thể tự xác nhận trùng lịch/i)).toBeInTheDocument();
    expect(within(pendingCard).getByText(/Không có dữ liệu liên hệ nào được tải/i)).toBeInTheDocument();
    expect(screen.queryByText(/090|@gmail\.com/)).not.toBeInTheDocument();
  });

  it("requests the selected status from the server", async () => {
    const mine = vi.spyOn(trialsApi, "mine").mockResolvedValue(page([]));
    renderPage();
    await screen.findByText("Không có yêu cầu");

    await userEvent.click(screen.getByRole("button", { name: "Đã hủy" }));
    expect(mine).toHaveBeenLastCalledWith(expect.objectContaining({ status: "cancelled" }));
  });

  it("guards double accept and renders the class plus activation state from the response", async () => {
    const user = userEvent.setup();
    const pending = trial();
    vi.spyOn(trialsApi, "mine").mockResolvedValue(page([pending]));
    let resolveAccept!: (value: TrialAcceptResponse) => void;
    const accept = vi.spyOn(trialsApi, "accept").mockImplementation(() => new Promise((resolve) => { resolveAccept = resolve; }));
    renderPage();

    const button = await screen.findByRole("button", { name: "Nhận dạy thử" });
    await user.click(button);
    expect(button).toBeDisabled();
    await user.click(button);
    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledWith(pending.id, { expected_version: 0 });

    const accepted = trial("accepted", {
      id: pending.id,
      activation: { state: "link_created", expires_at: "2026-08-02T01:00:00.000Z" },
    });
    resolveAccept({ trial: accepted, class_contract: { id: "class-1" } as TrialAcceptResponse["class_contract"], activation_token: "not-rendered" });

    expect(await screen.findByText("Lớp học thử đã được tạo.")).toBeInTheDocument();
    expect(screen.getByText(/đang chờ phụ huynh hoàn tất/i)).toBeInTheDocument();
    expect(screen.queryByText("not-rendered")).not.toBeInTheDocument();
  });

  it("validates and trims the decline reason before submitting", async () => {
    const user = userEvent.setup();
    const pending = trial();
    vi.spyOn(trialsApi, "mine").mockResolvedValue(page([pending]));
    const decline = vi.spyOn(trialsApi, "decline").mockResolvedValue(trial("declined", { id: pending.id, decline_reason: "Trùng lịch" }));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Từ chối" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận từ chối" }));
    expect(within(dialog).getByText("Vui lòng nhập lý do từ chối.")).toBeInTheDocument();

    await user.type(within(dialog).getByRole("textbox", { name: /Lý do gửi phụ huynh/ }), "  Trùng lịch  ");
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận từ chối" }));
    expect(decline).toHaveBeenCalledWith(pending.id, { reason: "Trùng lịch", expected_version: 0 });
    expect(await screen.findByText(/Đã từ chối yêu cầu và lưu lý do/)).toBeInTheDocument();
  });

  it("applies the current server state from a parent-cancel race conflict", async () => {
    const user = userEvent.setup();
    const pending = trial();
    const cancelled = trial("cancelled", { id: pending.id, version: 1 });
    vi.spyOn(trialsApi, "mine").mockResolvedValue(page([pending]));
    vi.spyOn(trialsApi, "accept").mockRejectedValue(
      new ApiClientError("conflict", "api", 409, "CONFLICT", { trial: cancelled }),
    );
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Nhận dạy thử" }));
    expect(await screen.findByText(/Phụ huynh đã hủy.*thao tác khác/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nhận dạy thử" })).not.toBeInTheDocument();
    expect(screen.getByText("Phụ huynh đã hủy")).toBeInTheDocument();
  });
});
