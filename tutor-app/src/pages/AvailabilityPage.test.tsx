import type { TutorAvailability } from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { availabilityApi } from "../lib/api/availability";
import { ApiClientError } from "../lib/api/errors";
import { AvailabilityPage } from "./AvailabilityPage";

function slot(partial: Partial<TutorAvailability>): TutorAvailability {
  return {
    id: partial.id ?? "s1",
    day_of_week: partial.day_of_week ?? 0,
    start_time: partial.start_time ?? "19:00",
    end_time: partial.end_time ?? "21:00",
    type: partial.type ?? "available",
    note: partial.note ?? null,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AvailabilityPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AvailabilityPage", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("renders existing slots with the Monday-first day mapping", async () => {
    vi.spyOn(availabilityApi, "list").mockResolvedValue({
      items: [slot({ id: "a", day_of_week: 0, start_time: "19:00", end_time: "21:00", type: "available" })],
    });
    renderPage();
    expect(await screen.findByText(/Thứ Hai · 19:00–21:00/)).toBeInTheDocument();
  });

  it("shows the empty state when there are no slots", async () => {
    vi.spyOn(availabilityApi, "list").mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText("Chưa có khung giờ")).toBeInTheDocument();
  });

  it("blocks create when end time is before start", async () => {
    const user = userEvent.setup();
    vi.spyOn(availabilityApi, "list").mockResolvedValue({ items: [] });
    const create = vi.spyOn(availabilityApi, "create");
    renderPage();

    await user.click(await screen.findByRole("button", { name: "+ Thêm khung giờ" }));
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Bắt đầu"));
    await user.type(within(dialog).getByLabelText("Bắt đầu"), "21:00");
    await user.clear(within(dialog).getByLabelText("Kết thúc"));
    await user.type(within(dialog).getByLabelText("Kết thúc"), "19:00");
    await user.click(within(dialog).getByRole("button", { name: "Lưu khung giờ" }));

    expect(create).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/sau giờ bắt đầu/)).toBeInTheDocument();
  });

  it("warns about overlap but still allows saving", async () => {
    const user = userEvent.setup();
    vi.spyOn(availabilityApi, "list").mockResolvedValue({
      items: [slot({ id: "a", day_of_week: 0, start_time: "19:00", end_time: "21:00" })],
    });
    vi.spyOn(availabilityApi, "create").mockResolvedValue({ id: "new" });
    renderPage();

    await screen.findByText(/Thứ Hai · 19:00–21:00/);
    await user.click(screen.getByRole("button", { name: "+ Thêm khung giờ" }));
    const dialog = await screen.findByRole("dialog");
    // Default form is Monday 19:00–21:00 which overlaps slot "a".
    expect(within(dialog).getByText(/trùng 1 khung/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Lưu khung giờ" }));
    await waitFor(() => expect(availabilityApi.create).toHaveBeenCalled());
  });

  it("creates a slot and optimistically adds it before the server responds", async () => {
    const user = userEvent.setup();
    vi.spyOn(availabilityApi, "list").mockResolvedValue({ items: [] });
    let resolveCreate: (value: { id: string }) => void = () => {};
    vi.spyOn(availabilityApi, "create").mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    renderPage();

    await user.click(await screen.findByRole("button", { name: "+ Thêm khung giờ" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Thứ"), "2");
    await user.click(within(dialog).getByRole("button", { name: "Lưu khung giờ" }));

    // Optimistic row appears immediately (Wednesday = value 2).
    expect(await screen.findByText(/Thứ Tư · 19:00–21:00/)).toBeInTheDocument();
    resolveCreate({ id: "new" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("rolls back and shows an error when create fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(availabilityApi, "list").mockResolvedValue({ items: [] });
    vi.spyOn(availabilityApi, "create").mockRejectedValue(
      new ApiClientError("start_time phải trước end_time", "api", 422, "VALIDATION_ERROR"),
    );
    renderPage();

    await user.click(await screen.findByRole("button", { name: "+ Thêm khung giờ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Lưu khung giờ" }));

    expect(await screen.findByText("start_time phải trước end_time")).toBeInTheDocument();
    // Optimistic row rolled back → back to empty state.
    expect(await screen.findByText("Chưa có khung giờ")).toBeInTheDocument();
  });

  it("deletes a slot and rolls back on server error", async () => {
    const user = userEvent.setup();
    vi.spyOn(availabilityApi, "list").mockResolvedValue({
      items: [slot({ id: "a", day_of_week: 0, start_time: "19:00", end_time: "21:00" })],
    });
    vi.spyOn(availabilityApi, "remove").mockRejectedValue(
      new ApiClientError("Không tìm thấy lịch", "api", 404, "RESOURCE_NOT_FOUND"),
    );
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Xóa" }));
    // Banner surfaces the server message verbatim for a failed delete.
    expect(await screen.findByText("Không tìm thấy lịch")).toBeInTheDocument();
    // Row restored after rollback.
    expect(screen.getByText(/Thứ Hai · 19:00–21:00/)).toBeInTheDocument();
  });
});
