import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const mocks = vi.hoisted(() => ({
  get: vi.fn<() => null>(() => null),
  set: vi.fn(),
  clear: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  passwordLogin: vi.fn(),
  restore: vi.fn(),
  setSessionExpiredHandler: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  adminTokenStore: { get: mocks.get, set: mocks.set, clear: mocks.clear },
  authApi: {
    logout: mocks.logout,
    me: mocks.me,
    passwordLogin: mocks.passwordLogin,
    restore: mocks.restore,
    setSessionExpiredHandler: mocks.setSessionExpiredHandler,
  },
}));

function LoginProbe() {
  const { login } = useAuth();
  return (
    <button
      type="button"
      onClick={() =>
        void login("admin@example.test", "correct-password").catch(
          () => undefined,
        )
      }
    >
      Đăng nhập
    </button>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockReturnValue(null);
  });

  it("clears only local state when /auth/me fails after password verification", async () => {
    mocks.restore.mockReturnValueOnce(new Promise(() => undefined));
    mocks.passwordLogin.mockResolvedValueOnce({
      access_token: "secret-access",
      consent_required: false,
      user: {
        id: "admin-1",
        email: "admin@example.test",
        phone: null,
        status: "active",
      },
    });
    mocks.me.mockRejectedValueOnce(new Error("Không tải được phiên"));
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LoginProbe />
        </AuthProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => expect(mocks.clear).toHaveBeenCalled());
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: "secret-access" }),
    );
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("restores the HttpOnly-cookie session before loading /auth/me", async () => {
    mocks.restore.mockResolvedValueOnce({ access_token: "restored-access" });
    mocks.me.mockResolvedValueOnce({
      user: {
        id: "admin-1",
        email: "admin@example.test",
        phone: null,
        status: "active",
      },
      roles: ["admin"],
      profiles: { parent: null, tutor: null },
    });
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <div>Protected</div>
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.restore).toHaveBeenCalledOnce());
    expect(mocks.restore.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.me.mock.invocationCallOrder[0],
    );
  });
});
