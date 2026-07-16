import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

const login = vi.fn();
vi.mock("../app/AuthContext", () => ({ useAuth: () => ({ login }) }));

describe("LoginPage", () => {
  beforeEach(() => login.mockReset());
  it("only submits normalized email and password", async () => {
    login.mockResolvedValueOnce({});
    render(<LoginPage />);

    expect(screen.queryByText(/Google|OTP|Số điện thoại/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " Admin@Example.Test " } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("admin@example.test", "correct-password"));
  });

  it("does not submit an incomplete form", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Nhập đầy đủ email và mật khẩu.");
    expect(login).not.toHaveBeenCalled();
  });
});
