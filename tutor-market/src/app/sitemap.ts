import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/config";
import { searchTutors } from "@/lib/api/public";

const PAGE_SIZE = 100;
// A sitemap can contain at most 50,000 URLs; reserve one for the home page.
const MAX_TUTOR_URLS = 49_999;
const MAX_PAGES = Math.ceil(MAX_TUTOR_URLS / PAGE_SIZE);

export const revalidate = 60;

/** Search API chỉ trả profile published, nên hidden/suspended không thể vào sitemap. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: string[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES && pages.length < MAX_TUTOR_URLS; page += 1) {
    let result: Awaited<ReturnType<typeof searchTutors>>;
    try {
      result = await searchTutors({ limit: PAGE_SIZE, sort: "newest", cursor });
    } catch {
      // Keep the static home URL valid when the API is unavailable during build.
      break;
    }
    pages.push(...result.items.slice(0, MAX_TUTOR_URLS - pages.length).map((tutor) => tutor.id));

    const nextCursor = result.next_cursor ?? undefined;
    if (!nextCursor || seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return [
    { url: absoluteUrl("/"), lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    ...pages.map((id) => ({
      url: absoluteUrl(`/tutors/${encodeURIComponent(id)}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
