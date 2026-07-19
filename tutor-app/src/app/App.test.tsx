import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, appTokenStore } from "../lib/api/client";
import { ApiClientError } from "../lib/api/errors";
import { App } from "./App";

function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
}

describe("App routes", () => {
  beforeEach(() => {
    appTokenStore.clear();
    // Khách chưa đăng nhập: boot đổi cookie ở /auth/refresh và nhận 401 → logged-out sạch.
    vi.spyOn(apiClient, "restoreSession").mockRejectedValue(
      new ApiClientError("Phiên đăng nhập đã hết hạn", "api", 401, "AUTH_REQUIRED"),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("does not render a protected deep route before authentication", async () => {
    renderApp("/availability");
    expect(await screen.findByRole("heading", { name: "Tiếp tục vào workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Lịch rảnh" })).not.toBeInTheDocument();
  });

  it("keeps login as a public route", async () => {
    renderApp("/login");
    // Boot khôi phục phiên chạy trước (loading ngắn), sau đó lộ route login công khai.
    expect(await screen.findByRole("heading", { name: "Tiếp tục vào workspace" })).toBeInTheDocument();
  });
});
