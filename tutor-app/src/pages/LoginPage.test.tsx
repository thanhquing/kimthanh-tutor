import type { AuthMeResponse, AuthSessionResponse } from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { authApi } from "../lib/api/auth";
import { apiClient, appTokenStore } from "../lib/api/client";
import { ApiClientError } from "../lib/api/errors";

const verified: AuthSessionResponse = {
  access_token: "access-token",
  user: { id: "user-1", phone: null, email: "p@gmail.com", status: "active" },
  consent_required: false,
};
const rolelessMe: AuthMeResponse = {
  user: verified.user,
  roles: [],
  profiles: { parent: null, tutor: null },
};

function renderLogin(initial = "/login?next=/classes") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initial]}><App /></MemoryRouter></QueryClientProvider>);
}

describe("LoginPage email + password", () => {
  beforeEach(() => {
    appTokenStore.clear();
    // Khách chưa đăng nhập: boot gọi restoreSession() và server trả 401 (không
    // có cookie hợp lệ) → phiên logged-out sạch, không có server-side error.
    vi.spyOn(apiClient, "restoreSession").mockRejectedValue(
      new ApiClientError("Phiên đăng nhập đã hết hạn", "api", 401, "AUTH_REQUIRED"),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("logs in with email + password and routes a roleless user to profile", async () => {
    const user = userEvent.setup();
    const login = vi.spyOn(authApi, "login").mockResolvedValue(verified);
    vi.spyOn(authApi, "me").mockResolvedValue(rolelessMe);
    renderLogin();

    await user.type(screen.getByRole("textbox", { name: "Email" }), "p@gmail.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "a-strong-password");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(login).toHaveBeenCalledWith({ email: "p@gmail.com", password: "a-strong-password" });
    expect(await screen.findByRole("heading", { name: "Hồ sơ gia sư" })).toBeInTheDocument();
  });

  it("prompts to resend verification when the email is not verified", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiClientError("Email chưa được xác thực.", "api", 403, "EMAIL_NOT_VERIFIED"),
    );
    const resend = vi.spyOn(authApi, "resendVerification").mockResolvedValue({ ok: true });
    renderLogin();

    await user.type(screen.getByRole("textbox", { name: "Email" }), "p@gmail.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "a-strong-password");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("chưa được xác thực");
    await user.click(screen.getByRole("button", { name: "Gửi lại email xác thực" }));
    expect(resend).toHaveBeenCalledWith({ email: "p@gmail.com" });
  });

  it("shows a generic error for wrong credentials", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiClientError("Email hoặc mật khẩu không đúng", "api", 401, "AUTH_REQUIRED"),
    );
    renderLogin();

    await user.type(screen.getByRole("textbox", { name: "Email" }), "p@gmail.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("không đúng");
  });
});
