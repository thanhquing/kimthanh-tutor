import { describe, expect, it } from "vitest";
import { facebookAccessTokenFromCallback, googleCredentialFromCallback } from "./oauth";

describe("OAuth callback mapper", () => {
  it("maps provider credentials into the server token contract", () => {
    expect(googleCredentialFromCallback({ credential: " google-id-token " })).toBe("google-id-token");
    expect(facebookAccessTokenFromCallback({ status: "connected", authResponse: { accessToken: " fb-access-token " } })).toBe("fb-access-token");
  });

  it("rejects cancelled or incomplete provider callbacks", () => {
    expect(() => googleCredentialFromCallback({})).toThrow(/không trả về/i);
    expect(() => facebookAccessTokenFromCallback({ status: "unknown" })).toThrow(/hủy|chưa hoàn tất/i);
  });
});
