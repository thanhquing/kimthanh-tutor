import { describe, expect, it } from "vitest";
import {
  normalizeAccountNumber,
  toPayoutAccountPayload,
  validatePayoutAccountForm,
} from "./payout-accounts";

const supportedBankCodes = new Set(["970436"]);

describe("payout account form", () => {
  it("normalizes number and holder before sending the PII-only request", () => {
    expect(toPayoutAccountPayload({
      bank_code: "970436",
      account_number: "1234 567-890",
      account_holder: "  Nguyễn   Thị  Linh ",
      is_default: true,
    })).toEqual({
      bank_code: "970436",
      account_number: "1234567890",
      account_holder: "Nguyễn Thị Linh",
      is_default: true,
    });
    expect(normalizeAccountNumber("12 34-56")).toBe("123456");
  });

  it("rejects an unknown bank and invalid account fields", () => {
    expect(validatePayoutAccountForm({
      bank_code: "999999",
      account_number: "ABC",
      account_holder: "",
      is_default: false,
    }, supportedBankCodes)).toEqual({
      bank_code: "Ngân hàng này hiện chưa được hỗ trợ.",
      account_number: "Số tài khoản cần gồm 6–19 chữ số.",
      account_holder: "Nhập tên chủ tài khoản hợp lệ.",
    });
  });
});
