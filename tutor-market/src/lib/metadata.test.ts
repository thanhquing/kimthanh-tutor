import { describe, expect, it } from "vitest";
import type { TutorPublicDetail } from "@kimthanh-tutor/contracts";
import { jsonLdHtml, publicSearchMetadata, tutorJsonLd, tutorMetadata } from "./metadata";

const lockedTutor: TutorPublicDetail = {
  id: "tutor-1",
  display_name: "Gia sư Minh Anh",
  avatar_media_id: null,
  subjects: ["Toán"],
  grade_levels: [9],
  teaching_modes: ["online"],
  region: "Hà Nội",
  education_level: "Cử nhân",
  school_name: null,
  fee_min: 180_000,
  fee_max: 220_000,
  rating_avg: 0,
  rating_count: 0,
  bio_snippet: "Thông tin giới thiệu công khai.",
  gender: null,
  voice_accent: null,
  unlock_state: "locked",
  unlock_via: null,
  paywall: { message: "Nội dung khóa riêng tư", products: ["single_unlock"] },
};

describe("public metadata", () => {
  it("uses an absolute canonical URL for search", () => {
    expect(publicSearchMetadata.alternates?.canonical?.toString()).toBe("http://localhost:3001/");
  });

  it("only maps public tutor preview fields", () => {
    const metadata = tutorMetadata(lockedTutor, "/tutors/tutor-1");
    const serialized = JSON.stringify(metadata);
    expect(serialized).toContain("http://localhost:3001/tutors/tutor-1");
    expect(serialized).toContain("Thông tin giới thiệu công khai.");
    expect(serialized).not.toContain("Nội dung khóa riêng tư");
    expect(serialized).not.toContain("single_unlock");
  });

  it("keeps JSON-LD limited to public profile data", () => {
    const serialized = JSON.stringify(tutorJsonLd(lockedTutor, "/tutors/tutor-1"));
    expect(serialized).toContain("Gia sư Minh Anh");
    expect(serialized).not.toContain("Nội dung khóa riêng tư");
  });

  it("escapes '<' so JSON-LD injected into <script> cannot break out", () => {
    const malicious: TutorPublicDetail = {
      ...lockedTutor,
      display_name: "Evil</script><script>alert(1)</script>",
    };
    const html = jsonLdHtml(tutorJsonLd(malicious, "/tutors/tutor-1"));
    // Không còn ký tự "<" thô nào lọt ra khung script.
    expect(html).not.toContain("<");
    expect(html).toContain("\\u003c");
    // Nội dung tên vẫn được giữ (chỉ khác cách encode "<").
    expect(JSON.parse(html).name).toBe(malicious.display_name);
  });
});
