import type { AuthMeResponse, TutorDashboardOverview } from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardApi } from "../lib/api/dashboard";
import { DashboardPage } from "./DashboardPage";

let mockAuth: { me: AuthMeResponse | null };

vi.mock("../app/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

function auth(tutorId = "tutor-1"): AuthMeResponse {
  return {
    user: { id: `user-${tutorId}`, phone: null, email: null, status: "active" },
    roles: ["tutor"],
    profiles: { parent: null, tutor: { id: tutorId } },
  };
}

function overview(overrides: Partial<TutorDashboardOverview> = {}): TutorDashboardOverview {
  return {
    profile: {
      id: "tutor-1",
      display_name: "Cô Linh",
      status: "published",
      moderation_status: "approved",
    },
    summary: { pending_trials: 1, teaching_classes: 1, pending_qr_records: 1 },
    pending_trials: [
      {
        id: "trial-1",
        subject: "Toán",
        grade: 8,
        teaching_mode: "online",
        created_at: "2026-07-19T01:00:00.000Z",
      },
    ],
    teaching_classes: [
      {
        id: "class-1",
        subject: "Toán lớp 8",
        status: "active",
        latest_lesson: {
          id: "lesson-1",
          lesson_at: "2026-07-18T12:00:00.000Z",
          subject: "Phân số",
        },
        can_create_lesson_log: true,
        updated_at: "2026-07-18T12:00:00.000Z",
      },
    ],
    pending_qr_records: [
      {
        id: "qr-1",
        class_contract_id: "class-1",
        amount: 800_000,
        collection_status: "created",
        created_at: "2026-07-19T01:00:00.000Z",
      },
    ],
    qr_subscription: {
      id: "sub-1",
      type: "tutor_qr",
      scope_ref_id: null,
      payment_id: "payment-1",
      status: "active",
      auto_renew: false,
      starts_at: "2026-07-01T00:00:00.000Z",
      current_period_end: "2026-08-01T00:00:00.000Z",
      cancelled_at: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
    capabilities: {
      has_payout_account: true,
      has_active_qr_access: true,
      can_create_qr: true,
    },
    partial_errors: [],
    ...overrides,
  };
}

function renderPage(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe("DashboardPage", () => {
  beforeEach(() => {
    mockAuth = { me: auth() };
    vi.restoreAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders real aggregate data and only valid capability actions", async () => {
    vi.spyOn(dashboardApi, "tutorOverview").mockResolvedValue(overview());
    renderPage();

    expect(await screen.findByRole("heading", { name: "Chào Linh 👋" })).toBeInTheDocument();
    expect(screen.getByText("Toán lớp 8")).toBeInTheDocument();
    expect(screen.getByText(/Hoạt động gần nhất/)).toBeInTheDocument();
    expect(screen.getByText(/800\.000/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tạo QR học phí" })).toBeInTheDocument();
    expect(screen.queryByText(/quá hạn ghi sổ/i)).not.toBeInTheDocument();
  });

  it("isolates a failed widget while keeping other aggregate data usable", async () => {
    vi.spyOn(dashboardApi, "tutorOverview").mockResolvedValue(
      overview({
        summary: { pending_trials: 0, teaching_classes: 1, pending_qr_records: 1 },
        pending_trials: [],
        partial_errors: ["pending_trials"],
      }),
    );
    renderPage();

    expect(await screen.findByText(/Một vài mục đang gián đoạn/)).toBeInTheDocument();
    expect(screen.getByText("Toán lớp 8")).toBeInTheDocument();
    expect(screen.getByText(/800\.000/)).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu mục này tạm thời chưa tải được.")).toBeInTheDocument();
  });

  it("never offers QR creation before payout and QR access are both ready", async () => {
    vi.spyOn(dashboardApi, "tutorOverview").mockResolvedValue(
      overview({
        qr_subscription: null,
        capabilities: {
          has_payout_account: false,
          has_active_qr_access: false,
          can_create_qr: false,
        },
      }),
    );
    renderPage();

    await screen.findByRole("heading", { name: "Chào Linh 👋" });
    expect(screen.queryByRole("link", { name: "Tạo QR học phí" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Thêm tài khoản nhận tiền" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kích hoạt gói QR" })).toBeInTheDocument();
  });

  it("retries a total load error", async () => {
    const user = userEvent.setup();
    vi.spyOn(dashboardApi, "tutorOverview")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(overview());
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("heading", { name: "Chào Linh 👋" })).toBeInTheDocument();
  });

  it("uses the tutor id in the query key so switched users never retain old data", async () => {
    const api = vi.spyOn(dashboardApi, "tutorOverview")
      .mockResolvedValueOnce(overview())
      .mockResolvedValueOnce(
        overview({
          profile: {
            id: "tutor-2",
            display_name: "Thầy Nam",
            status: "draft",
            moderation_status: "pending",
          },
        }),
      );
    const view = renderPage();
    expect(await screen.findByRole("heading", { name: "Chào Linh 👋" })).toBeInTheDocument();

    mockAuth = { me: auth("tutor-2") };
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("heading", { name: "Chào Linh 👋" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Chào Nam 👋" })).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(2);
  });
});
