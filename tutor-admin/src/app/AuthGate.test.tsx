import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AdminAccess } from "./AuthGate";

vi.mock("./AuthContext", () => ({ useAuth: () => ({ logout: vi.fn() }) }));

const user = { id: "admin-1", email: "admin@example.test", phone: null, status: "active" as const };
function access(roles: Array<"admin" | "parent">, status: "active" | "pending_consent" | "suspended" = "active") { return { user: { ...user, status }, roles, profiles: { parent: null, tutor: null } }; }

describe("AdminAccess", () => {
  it("does not render protected content for a non-admin token", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AdminAccess me={access(["parent"])}>Secret data</AdminAccess></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Không có quyền quản trị" })).toBeInTheDocument();
    expect(screen.queryByText("Secret data")).not.toBeInTheDocument();
  });
  it("blocks pending consent before the shell", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AdminAccess me={access(["admin"], "pending_consent")}>Secret data</AdminAccess></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Cần hoàn tất đồng ý pháp lý" })).toBeInTheDocument();
  });
  it("blocks a suspended admin before the shell", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AdminAccess me={access(["admin"], "suspended")}>Secret data</AdminAccess></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Tài khoản đã bị tạm ngưng" })).toBeInTheDocument();
    expect(screen.queryByText("Secret data")).not.toBeInTheDocument();
  });
  it("permits an active admin", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AdminAccess me={access(["admin"])}>Secret data</AdminAccess></MemoryRouter>);
    expect(screen.getByText("Secret data")).toBeInTheDocument();
  });
});
