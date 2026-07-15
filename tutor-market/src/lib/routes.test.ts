import { describe, expect, it } from "vitest";
import { legacyRedirects } from "./routes";

describe("legacy market routes", () => {
  it("redirect aliases to canonical internal routes", () => {
    expect(legacyRedirects).toEqual({
      "/search": "/",
      "/tutor-detail": "/",
      "/parent-profile": "/account",
      "/subscriptions": "/billing",
    });
  });
});
