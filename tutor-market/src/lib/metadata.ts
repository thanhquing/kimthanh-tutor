import type { Metadata } from "next";
import type { TutorPublicDetail } from "@kimthanh-tutor/contracts";
import { absoluteUrl } from "@/lib/config";

export const publicSearchMetadata: Metadata = {
  title: "Tìm gia sư phù hợp",
  description: "Tìm gia sư theo môn học, khối lớp và hình thức học.",
  alternates: { canonical: absoluteUrl("/") },
  openGraph: { type: "website", url: absoluteUrl("/"), title: "Kim Thanh Tutor", description: "Tìm gia sư phù hợp cho con bạn.", images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: "Kim Thanh Tutor" }] },
};

export function tutorMetadata(tutor: TutorPublicDetail, path: string): Metadata {
  const title = `${tutor.display_name} | Gia sư trên Kim Thanh Tutor`;
  const description = tutor.bio_snippet ?? `Xem thông tin công khai của gia sư ${tutor.display_name}.`;
  // API hiện chỉ trả media ID, không có URL avatar public đã duyệt; tuyệt đối không
  // dựng URL đoán hoặc dùng signed media. OG dùng social image thương hiệu an toàn
  // cho tới khi API bổ sung CDN approved.
  return { title, description, alternates: { canonical: absoluteUrl(path) }, openGraph: { type: "profile", url: absoluteUrl(path), title, description, images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: "Kim Thanh Tutor" }] } };
}

export function tutorJsonLd(tutor: TutorPublicDetail, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": ["ProfilePage", "Person"],
    url: absoluteUrl(path),
    name: tutor.display_name,
    description: tutor.bio_snippet ?? undefined,
    knowsAbout: tutor.subjects,
  };
}
