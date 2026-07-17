import type { ActiveLegalDocumentsResponse, AuthMeResponse } from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { authApi } from "../lib/api/auth";
import { appTokenStore } from "../lib/api/client";
import { ApiClientError } from "../lib/api/errors";

const pendingMe: AuthMeResponse = {
  user: { id: "user-1", phone: "0900000000", email: null, status: "pending_consent" },
  roles: [],
  profiles: { parent: null, tutor: null },
};
const activeMe: AuthMeResponse = {
  ...pendingMe,
  user: { ...pendingMe.user, status: "active" },
};
const docs: ActiveLegalDocumentsResponse = {
  terms: { id: "terms-1", doc_type: "terms", version: "v1", title: "Điều khoản v1", content_url: "https://example.test/terms", checksum: "terms-checksum", published_at: "2026-07-17T00:00:00.000Z" },
  privacy: { id: "privacy-1", doc_type: "privacy", version: "v1", title: "Chính sách v1", content_url: "https://example.test/privacy", checksum: "privacy-checksum", published_at: "2026-07-17T00:00:00.000Z" },
};

function renderConsent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/consent?next=/dashboard"]}><App /></MemoryRouter></QueryClientProvider>);
}

function reachBottom() {
  const scroll = screen.getByLabelText(/tóm tắt tài liệu pháp lý/i);
  Object.defineProperties(scroll, {
    scrollHeight: { configurable: true, value: 1_000 },
    clientHeight: { configurable: true, value: 300 },
    scrollTop: { configurable: true, value: 700 },
  });
  fireEvent.scroll(scroll);
}

describe("ConsentPage", () => {
  beforeEach(() => appTokenStore.set({ access_token: "access", refresh_token: "refresh" }));
  afterEach(() => {
    appTokenStore.clear();
    vi.restoreAllMocks();
  });

  it("requires scroll and checkbox before posting both document IDs", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "me").mockResolvedValueOnce(pendingMe).mockResolvedValueOnce(activeMe);
    vi.spyOn(authApi, "activeLegalDocuments").mockResolvedValue(docs);
    const record = vi.spyOn(authApi, "recordConsent").mockResolvedValue({ ok: true, user_status: "active" });
    renderConsent();

    const checkbox = await screen.findByRole("checkbox");
    const submit = screen.getByRole("button", { name: "Đồng ý và tiếp tục" });
    expect(checkbox).toBeDisabled();
    expect(submit).toBeDisabled();

    reachBottom();
    expect(checkbox).toBeEnabled();
    await user.click(checkbox);
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(record).toHaveBeenCalledWith({
      terms_document_id: "terms-1",
      privacy_document_id: "privacy-1",
      scroll_reached_bottom: true,
      consent_method: "scroll_and_click",
    });
    expect(await screen.findByRole("heading", { name: "Hồ sơ gia sư" })).toBeInTheDocument();
  });

  it("resets the scroll gate when the active document version changes", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "me").mockResolvedValue(pendingMe);
    vi.spyOn(authApi, "activeLegalDocuments")
      .mockResolvedValueOnce(docs)
      .mockResolvedValue({
        terms: { ...docs.terms!, id: "terms-2", version: "v2", title: "Điều khoản v2" },
        privacy: { ...docs.privacy!, id: "privacy-2", version: "v2", title: "Chính sách v2" },
      });
    vi.spyOn(authApi, "recordConsent").mockRejectedValue(new ApiClientError("Văn bản đã hết hiệu lực", "api", 400, "VALIDATION_ERROR"));
    renderConsent();

    const checkbox = await screen.findByRole("checkbox");
    reachBottom();
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "Đồng ý và tiếp tục" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/phiên bản tài liệu có thể vừa thay đổi/i);
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeDisabled());
    expect(await screen.findByRole("heading", { name: "Điều khoản v2" })).toBeInTheDocument();
  });
});
