import { describe, expect, it, vi } from "vitest";
import { AdminApi } from "./admin";

describe("AdminApi", () => {
  it("keeps keyset cursor and reason mutation in the typed client", async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    const api = new AdminApi({ request } as never);
    await api.users({ status: "suspended", cursor: "next-01", limit: 20 });
    await api.setUserStatus("user/1", { status: "suspended", reason: "Vi phạm chính sách" });
    expect(request).toHaveBeenNthCalledWith(1, "/admin/users?status=suspended&cursor=next-01&limit=20", { signal: undefined });
    expect(request).toHaveBeenNthCalledWith(2, "/admin/users/user%2F1/status", { method: "PATCH", body: { status: "suspended", reason: "Vi phạm chính sách" }, signal: undefined });
  });
});
