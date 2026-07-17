import type { AuthMeResponse, AuthVerifyResponse } from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { authApi } from "../lib/api/auth";
import { appTokenStore } from "../lib/api/client";
import { ApiClientError } from "../lib/api/errors";

const verified: AuthVerifyResponse = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  user: { id: "user-1", phone: "0900000000", email: null, status: "active" },
  consent_required: false,
};
const rolelessMe: AuthMeResponse = {
  user: verified.user,
  roles: [],
  profiles: { parent: null, tutor: null },
};

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/login?next=/classes"]}><App /></MemoryRouter></QueryClientProvider>);
}

describe("LoginPage OTP fallback", () => {
  beforeEach(() => appTokenStore.clear());
  afterEach(() => vi.restoreAllMocks());

  it("keeps request_id across the two OTP steps and routes roleless user to profile", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "requestOtp").mockResolvedValue({ request_id: "otp-request-1", expires_at: new Date(Date.now() + 60_000).toISOString() });
    const verify = vi.spyOn(authApi, "verifyOtp").mockResolvedValue(verified);
    vi.spyOn(authApi, "me").mockResolvedValue(rolelessMe);
    renderLogin();

    await user.type(screen.getByRole("textbox", { name: "Số điện thoại" }), "0900000000");
    await user.click(screen.getByRole("button", { name: "Gửi mã OTP" }));
    expect(authApi.requestOtp).toHaveBeenCalledWith({ channel: "sms", destination: "0900000000" });

    await user.type(await screen.findByLabelText("Mã OTP"), "272727");
    await user.click(screen.getByRole("button", { name: "Xác nhận OTP" }));
    expect(verify).toHaveBeenCalledWith({ request_id: "otp-request-1", code: "272727" });
    expect(await screen.findByRole("heading", { name: "Hồ sơ gia sư" })).toBeInTheDocument();
  });

  it("shows a clear wrong-OTP error without losing the request", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "requestOtp").mockResolvedValue({ request_id: "otp-request-2", expires_at: new Date(Date.now() + 60_000).toISOString() });
    vi.spyOn(authApi, "verifyOtp").mockRejectedValue(new ApiClientError("OTP sai", "api", 400, "VALIDATION_ERROR"));
    renderLogin();

    await user.type(screen.getByRole("textbox", { name: "Số điện thoại" }), "0900000000");
    await user.click(screen.getByRole("button", { name: "Gửi mã OTP" }));
    await user.type(await screen.findByLabelText("Mã OTP"), "000000");
    await user.click(screen.getByRole("button", { name: "Xác nhận OTP" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("OTP sai");
    expect(screen.getByLabelText("Mã OTP")).toBeInTheDocument();
  });
});
