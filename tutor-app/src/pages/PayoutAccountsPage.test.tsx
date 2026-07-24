import type { TutorPayoutAccount, TutorPayoutBank } from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { payoutAccountsApi } from "../lib/api/payout-accounts";
import { PayoutAccountsPage } from "./PayoutAccountsPage";

const banks: TutorPayoutBank[] = [{ bank_code: "970436", name: "Vietcombank" }];
const account: TutorPayoutAccount = {
  id: "payout-1",
  bank_code: "970436",
  account_number_masked: "******7890",
  account_holder: "NGUYỄN THỊ LINH",
  is_default: true,
  created_at: "2026-07-24T00:00:00.000Z",
  updated_at: "2026-07-24T00:00:00.000Z",
};
const secondaryAccount: TutorPayoutAccount = {
  ...account,
  id: "payout-2",
  account_number_masked: "******4321",
  is_default: false,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><PayoutAccountsPage /></MemoryRouter></QueryClientProvider>);
}

describe("PayoutAccountsPage", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("renders only the masked payout account and its server-selected default", async () => {
    vi.spyOn(payoutAccountsApi, "listBanks").mockResolvedValue({ items: banks });
    vi.spyOn(payoutAccountsApi, "list").mockResolvedValue({ items: [account] });
    renderPage();

    expect(await screen.findByText("Vietcombank")).toBeInTheDocument();
    expect(screen.getByText("******7890 · NGUYỄN THỊ LINH")).toBeInTheDocument();
    expect(screen.getByText("Mặc định")).toBeInTheDocument();
  });

  it("validates before sending and resets PII form values after a safe response", async () => {
    const user = userEvent.setup();
    vi.spyOn(payoutAccountsApi, "listBanks").mockResolvedValue({ items: banks });
    vi.spyOn(payoutAccountsApi, "list").mockResolvedValue({ items: [] });
    const create = vi.spyOn(payoutAccountsApi, "create").mockResolvedValue(account);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Thêm tài khoản" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Lưu tài khoản" }));
    expect(create).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Hãy chọn ngân hàng nhận tiền.")).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Ngân hàng" }), "970436");
    await user.type(within(dialog).getByRole("textbox", { name: "Số tài khoản" }), "1234 567-890");
    await user.type(within(dialog).getByRole("textbox", { name: "Tên chủ tài khoản" }), "Nguyễn Thị Linh");
    await user.click(within(dialog).getByRole("button", { name: "Lưu tài khoản" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({
      bank_code: "970436",
      account_number: "1234567890",
      account_holder: "Nguyễn Thị Linh",
      is_default: true,
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("1234 567-890")).not.toBeInTheDocument();
    expect(screen.queryByText("1234567890")).not.toBeInTheDocument();
    expect(await screen.findByText(/Số tài khoản chỉ còn được hiển thị ở dạng che/)).toBeInTheDocument();
  });

  it("shows a safe empty state when no account exists", async () => {
    vi.spyOn(payoutAccountsApi, "listBanks").mockResolvedValue({ items: banks });
    vi.spyOn(payoutAccountsApi, "list").mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText("Chưa có tài khoản nhận tiền")).toBeInTheDocument();
  });

  it("lets the tutor choose another saved account as default", async () => {
    const user = userEvent.setup();
    vi.spyOn(payoutAccountsApi, "listBanks").mockResolvedValue({ items: banks });
    vi.spyOn(payoutAccountsApi, "list").mockResolvedValue({ items: [account, secondaryAccount] });
    const setDefault = vi.spyOn(payoutAccountsApi, "setDefault").mockResolvedValue({ ...secondaryAccount, is_default: true });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Đặt mặc định" }));

    await waitFor(() => expect(setDefault).toHaveBeenCalledWith("payout-2"));
    expect(await screen.findByText("Đã đặt tài khoản nhận tiền mặc định.")).toBeInTheDocument();
  });
});
