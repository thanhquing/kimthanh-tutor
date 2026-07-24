import type { PayoutAccountCreatePayload } from "../api/payout-accounts";

export interface PayoutAccountForm {
  bank_code: string;
  account_number: string;
  account_holder: string;
  is_default: boolean;
}

export type PayoutAccountFormErrors = Partial<Record<keyof PayoutAccountForm, string>>;

export const EMPTY_PAYOUT_ACCOUNT_FORM: PayoutAccountForm = {
  bank_code: "",
  account_number: "",
  account_holder: "",
  is_default: false,
};

export function normalizeAccountNumber(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export function normalizeAccountHolder(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validatePayoutAccountForm(
  form: PayoutAccountForm,
  supportedBankCodes: ReadonlySet<string>,
): PayoutAccountFormErrors {
  const errors: PayoutAccountFormErrors = {};
  const accountNumber = normalizeAccountNumber(form.account_number);
  const accountHolder = normalizeAccountHolder(form.account_holder);

  if (!form.bank_code) errors.bank_code = "Hãy chọn ngân hàng nhận tiền.";
  else if (!supportedBankCodes.has(form.bank_code)) errors.bank_code = "Ngân hàng này hiện chưa được hỗ trợ.";
  if (!/^\d{6,19}$/.test(accountNumber)) errors.account_number = "Số tài khoản cần gồm 6–19 chữ số.";
  if (!/^[\p{L}][\p{L}\p{M}\s.'-]*$/u.test(accountHolder)) {
    errors.account_holder = "Nhập tên chủ tài khoản hợp lệ.";
  } else if (accountHolder.length > 120) {
    errors.account_holder = "Tên chủ tài khoản không quá 120 ký tự.";
  }
  return errors;
}

export function hasPayoutAccountFormErrors(errors: PayoutAccountFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function toPayoutAccountPayload(form: PayoutAccountForm): PayoutAccountCreatePayload {
  return {
    bank_code: form.bank_code,
    account_number: normalizeAccountNumber(form.account_number),
    account_holder: normalizeAccountHolder(form.account_holder),
    is_default: form.is_default,
  };
}
