import type { AuthMeResponse } from "@kimthanh-tutor/contracts";
import { describe, expect, it } from "vitest";
import { routeAfterAuth, safeNextPath } from "./redirects";

const baseMe: AuthMeResponse = {
  user: { id: "user-1", phone: null, email: null, status: "active" },
  roles: ["tutor"],
  profiles: { parent: null, tutor: { id: "tutor-1" } },
};

describe("safe auth redirects", () => {
  it("keeps only allowlisted local workspace routes", () => {
    expect(safeNextPath("/classes/class-1?tab=logs#latest")).toBe("/classes/class-1?tab=logs#latest");
    expect(safeNextPath("https://evil.test/steal")).toBe("/dashboard");
    expect(safeNextPath("//evil.test/steal")).toBe("/dashboard");
    expect(safeNextPath("/login?next=//evil.test")).toBe("/dashboard");
    expect(safeNextPath("/dashboard\\@evil.test")).toBe("/dashboard");
  });

  it("routes pending, bootstrap and wrong-role users safely", () => {
    expect(routeAfterAuth({ ...baseMe, user: { ...baseMe.user, status: "pending_consent" } }, "/classes")).toBe("/consent?next=%2Fclasses");
    expect(routeAfterAuth({ ...baseMe, roles: [], profiles: { parent: null, tutor: null } }, "/dashboard")).toBe("/profile");
    expect(routeAfterAuth({ ...baseMe, roles: ["parent"], profiles: { parent: { id: "parent-1" }, tutor: null } }, "/dashboard")).toBe("/forbidden");
  });
});
