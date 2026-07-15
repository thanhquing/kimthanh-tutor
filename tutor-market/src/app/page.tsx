import { TutorCard } from "@/components/TutorCard";
import { publicSearchMetadata } from "@/lib/metadata";
import { searchTutors } from "@/lib/api/public";

// Search là SSR để luôn có nội dung public cho crawler. Bộ lọc tương tác thuộc TM-01.
export const dynamic = "force-dynamic";
export const metadata = publicSearchMetadata;

export default async function SearchPage() {
  const page = await searchTutors({ limit: 12, sort: "newest" });
  return (
    <>
      <section className="search-hero">
        <div className="container">
          <div className="hero-headline">
            <span className="hero-eyebrow">Nền tảng gia sư cho phụ huynh Việt</span>
            <h1>Tìm gia sư phù hợp cho con — chỉ vài phút.</h1>
            <p>Khám phá thông tin công khai của gia sư, chọn người phù hợp và quyết định khi nào cần mở khóa hồ sơ chi tiết.</p>
          </div>
        </div>
      </section>
      <section className="results-section" aria-labelledby="result-heading">
        <div className="container">
          <div className="results-header">
            <div>
              <h2 id="result-heading">Gia sư mới cập nhật</h2>
              <p>Bản xem trước chỉ hiển thị thông tin công khai đã được phép.</p>
            </div>
          </div>
          {page.items.length ? <div className="cards">{page.items.map((tutor) => <TutorCard key={tutor.id} tutor={tutor} />)}</div> : <div className="empty-state"><div className="state-mark" aria-hidden="true">⌕</div><h3>Chưa có gia sư phù hợp</h3><p>Hãy quay lại sau hoặc thử tiêu chí khác khi bộ lọc được mở.</p></div>}
        </div>
      </section>
    </>
  );
}
