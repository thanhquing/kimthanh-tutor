import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "./AuthContext";
import { AppShell } from "./AppShell";

function renderShell(path = "/dashboard") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}><AuthProvider><Routes><Route element={<AppShell />}><Route path="*" element={<h1>Nội dung route</h1>} /></Route></Routes></AuthProvider></MemoryRouter></QueryClientProvider>);
}

describe("AppShell", () => {
  it("marks the current navigation item and renders route content", () => {
    renderShell("/classes/detail-01");
    expect(screen.getByRole("heading", { name: "Nội dung route" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Lớp học/ })[0]).toHaveClass("active");
    expect(document.title).toBe("Lớp học | Kim Thành Tutor");
  });

  it("opens and closes the mobile drawer with keyboard", async () => {
    const user = userEvent.setup();
    renderShell();
    const menu = screen.getByRole("button", { name: "Mở menu" });
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
  });
});
