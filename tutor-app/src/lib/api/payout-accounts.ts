import type { TutorPayoutAccount, TutorPayoutBank } from "@kimthanh-tutor/contracts";
import { apiClient } from "./client";

export interface PayoutAccountCreatePayload {
  bank_code: string;
  account_number: string;
  account_holder: string;
  is_default: boolean;
}

export const payoutAccountsApi = {
  listBanks() {
    return apiClient.request<{ items: TutorPayoutBank[] }>("/tutors/me/payout-accounts/banks");
  },
  list() {
    return apiClient.request<{ items: TutorPayoutAccount[] }>("/tutors/me/payout-accounts");
  },
  create(payload: PayoutAccountCreatePayload) {
    return apiClient.request<TutorPayoutAccount>("/tutors/me/payout-accounts", {
      method: "POST",
      body: payload,
    });
  },
  setDefault(id: string) {
    return apiClient.request<TutorPayoutAccount>(`/tutors/me/payout-accounts/${id}/default`, {
      method: "PATCH",
    });
  },
};
