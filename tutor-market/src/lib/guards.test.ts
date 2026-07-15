import { describe, expect, it } from "vitest";
import { decideRouteAccess, safeInternalNext } from "./guards";
describe("market route guards", () => { it("chặn parent route khi chưa đăng nhập", () => expect(decideRouteAccess({ authenticated: false, roles: [] }, { authenticated: true, roles: ["parent"] })).toMatchObject({ allowed: false, reason: "auth" })); it("không cho open redirect", () => { expect(safeInternalNext("https://evil.example")).toBe("/account"); expect(safeInternalNext("/students/a")).toBe("/students/a"); }); });
