import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

const logout = vi.fn();
vi.mock("./AuthContext", () => ({
  useAuth: () => ({
    logout,
    me: { user: { email: "admin@example.test" } },
  }),
}));

describe("AppShell", () => {
  it("renders protected navigation and delegates logout to the auth context", () => {
    render(<MemoryRouter initialEntries={["/users"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route element={<AppShell />}><Route path="/users" element={<p>Nội dung người dùng</p>} /></Route></Routes></MemoryRouter>);

    expect(screen.getByText("Nội dung người dùng")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Tổng quan/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("admin@example.test")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Đăng xuất/ }));
    expect(logout).toHaveBeenCalledOnce();
  });
});
