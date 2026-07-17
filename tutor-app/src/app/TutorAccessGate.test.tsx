import type { AuthMeResponse } from "@kimthanh-tutor/contracts";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TutorAccess } from "./TutorAccessGate";

const tutorMe: AuthMeResponse = {
  user: { id: "user-1", phone: null, email: null, status: "active" },
  roles: ["tutor"],
  profiles: { parent: null, tutor: { id: "tutor-1" } },
};

function renderAccess(me: AuthMeResponse | null, path = "/dashboard") {
  return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}><Routes>
    <Route path="*" element={<TutorAccess me={me} pathname={path}><h1>Dữ liệu được bảo vệ</h1></TutorAccess>} />
    <Route path="/login" element={<h1>Màn đăng nhập</h1>} />
    <Route path="/consent" element={<h1>Màn consent</h1>} />
    <Route path="/profile" element={<h1>Khởi tạo hồ sơ</h1>} />
    <Route path="/forbidden" element={<h1>Sai vai trò</h1>} />
    <Route path="/account-unavailable" element={<h1>Tài khoản tạm ngưng</h1>} />
  </Routes></MemoryRouter>);
}

describe("TutorAccess", () => {
  it("never renders protected content before authentication or consent", async () => {
    renderAccess(null);
    expect(await screen.findByRole("heading", { name: "Màn đăng nhập" })).toBeInTheDocument();
    expect(screen.queryByText("Dữ liệu được bảo vệ")).not.toBeInTheDocument();

    const pending = { ...tutorMe, user: { ...tutorMe.user, status: "pending_consent" as const } };
    renderAccess(pending);
    expect(await screen.findByRole("heading", { name: "Màn consent" })).toBeInTheDocument();
  });

  it("allows a roleless active user to bootstrap only at profile", async () => {
    const roleless = { ...tutorMe, roles: [], profiles: { parent: null, tutor: null } };
    renderAccess(roleless);
    expect(await screen.findByRole("heading", { name: "Khởi tạo hồ sơ" })).toBeInTheDocument();
  });

  it("blocks parent-only and suspended accounts", async () => {
    renderAccess({ ...tutorMe, roles: ["parent"], profiles: { parent: { id: "parent-1" }, tutor: null } });
    expect(await screen.findByRole("heading", { name: "Sai vai trò" })).toBeInTheDocument();

    renderAccess({ ...tutorMe, user: { ...tutorMe.user, status: "suspended" } });
    expect(await screen.findByRole("heading", { name: "Tài khoản tạm ngưng" })).toBeInTheDocument();
  });

  it("renders protected content for an active tutor", () => {
    renderAccess(tutorMe);
    expect(screen.getByRole("heading", { name: "Dữ liệu được bảo vệ" })).toBeInTheDocument();
  });
});
