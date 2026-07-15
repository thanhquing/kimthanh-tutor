import { describe, expect, it } from "vitest";
import { decideRouteAccess } from "./guards";

const activeTutor = { authenticated: true, status: "active" as const, roles: ["tutor" as const], acceptedLegalVersion: "v1" };

describe("capability route guard", () => {
  it("fails closed for anonymous, consent and wrong role", () => {
    expect(decideRouteAccess({ authenticated: false, roles: [] }, { authenticated: true })).toMatchObject({ allowed: false, reason: "auth" });
    expect(decideRouteAccess({ ...activeTutor, status: "pending_consent" }, { authenticated: true })).toMatchObject({ allowed: false, reason: "consent" });
    expect(decideRouteAccess(activeTutor, { authenticated: true, roles: ["admin"] })).toMatchObject({ allowed: false, reason: "role" });
  });

  it("allows a tutor with the required legal version", () => {
    expect(decideRouteAccess(activeTutor, { authenticated: true, roles: ["tutor"], legalVersion: "v1" })).toEqual({ allowed: true });
  });
});
