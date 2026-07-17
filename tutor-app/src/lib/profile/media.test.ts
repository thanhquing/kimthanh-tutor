import { describe, expect, it } from "vitest";
import { mediaStateLabel, validateMediaFile } from "./media";

describe("validateMediaFile", () => {
  it("accepts a valid avatar image within size", () => {
    expect(validateMediaFile("avatar", { type: "image/png", size: 1024 })).toBeNull();
  });

  it("rejects an avatar with a wrong MIME type", () => {
    expect(validateMediaFile("avatar", { type: "application/pdf", size: 1024 })).toMatch(/Định dạng/);
  });

  it("rejects an avatar over the 5MB limit", () => {
    expect(validateMediaFile("avatar", { type: "image/png", size: 6 * 1024 * 1024 })).toMatch(/Kích thước/);
  });

  it("accepts an mp4 intro video within 100MB", () => {
    expect(validateMediaFile("intro_video", { type: "video/mp4", size: 50 * 1024 * 1024 })).toBeNull();
  });

  it("rejects a zero-byte file", () => {
    expect(validateMediaFile("intro_video", { type: "video/mp4", size: 0 })).toMatch(/Kích thước/);
  });
});

describe("mediaStateLabel", () => {
  it("flags an infected scan as danger regardless of moderation", () => {
    expect(mediaStateLabel("infected", "approved").tone).toBe("danger");
  });

  it("flags a rejected moderation as danger", () => {
    expect(mediaStateLabel("clean", "rejected").tone).toBe("danger");
  });

  it("shows pending scan first", () => {
    expect(mediaStateLabel("pending", "pending").tone).toBe("pending");
  });

  it("shows awaiting moderation when scan is clean", () => {
    expect(mediaStateLabel("clean", "pending").tone).toBe("warn");
  });

  it("shows approved when clean and approved", () => {
    expect(mediaStateLabel("clean", "approved").tone).toBe("ok");
  });
});
