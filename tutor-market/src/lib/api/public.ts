import type { KeysetPage, TutorPublicDetail, TutorSearchCard, TutorSearchQuery } from "@kimthanh-tutor/contracts";
import { marketConfig } from "@/lib/config";
import { devPublicTutor, devSearchTutors } from "./public.dev";

function queryString(query: TutorSearchQuery): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") search.set(key, String(value));
  return search.toString();
}

/** Chỉ dùng ở Server Components: response public được ISR ngắn, không có cookie/token. */
export async function searchTutors(query: TutorSearchQuery = {}): Promise<KeysetPage<TutorSearchCard>> {
  if (marketConfig.useDevFixtures) return devSearchTutors(query);
  const suffix = queryString(query);
  const response = await fetch(`${marketConfig.apiBaseUrl}/tutors/search${suffix ? `?${suffix}` : ""}`, { next: { revalidate: 60 }, headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Không thể tải danh sách gia sư");
  return response.json() as Promise<KeysetPage<TutorSearchCard>>;
}

export async function getPublicTutor(id: string): Promise<TutorPublicDetail | null> {
  if (marketConfig.useDevFixtures) return devPublicTutor(id);
  const response = await fetch(`${marketConfig.apiBaseUrl}/tutors/${encodeURIComponent(id)}/public`, { next: { revalidate: 300 }, headers: { accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Không thể tải hồ sơ gia sư");
  return response.json() as Promise<TutorPublicDetail>;
}
