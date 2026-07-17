import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { appTokenStore } from "../lib/api/client";
import { App } from "./App";

function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
}

describe("App routes", () => {
  beforeEach(() => appTokenStore.clear());

  it("does not render a protected deep route before authentication", async () => {
    renderApp("/availability");
    expect(await screen.findByRole("heading", { name: "Tiếp tục vào workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Lịch rảnh" })).not.toBeInTheDocument();
  });

  it("keeps login as a public route", () => {
    renderApp("/login");
    expect(screen.getByRole("heading", { name: "Tiếp tục vào workspace" })).toBeInTheDocument();
  });
});
