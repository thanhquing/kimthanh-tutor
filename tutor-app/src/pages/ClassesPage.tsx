import type { ClassDetail, KeysetPage } from "@kimthanh-tutor/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, Clock3, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";
import { classesApi } from "../lib/api/classes";
import { classStatusPresentation, groupClasses } from "../lib/classes/classes";
import { formatUtcForVietnam } from "../lib/format";

function ClassCard({ item }: { item: ClassDetail }) {
  const status = classStatusPresentation(item.status);
  return (
    <article className="class-card" data-status={item.status}>
      <div className="class-card-icon"><BookOpen size={21} aria-hidden="true" /></div>
      <div className="class-card-copy">
        <div className="class-card-title">
          <h3>{item.subject}</h3>
          <span className={`profile-status tone-${status.tone}`}>{status.label}</span>
        </div>
        <p><UsersRound size={15} aria-hidden="true" />{item.student ? `${item.student.name} · Lớp ${item.student.grade}` : "Chưa liên kết học sinh"}</p>
        <small><Clock3 size={14} aria-hidden="true" />Cập nhật {formatUtcForVietnam(item.updated_at)}</small>
      </div>
      <Link className="class-open" to={`/classes/${encodeURIComponent(item.id)}`} aria-label={`Mở lớp ${item.subject}`}>
        <ChevronRight size={20} aria-hidden="true" />
      </Link>
    </article>
  );
}

function ClassGroup({ title, items }: { title: string; items: ClassDetail[] }) {
  if (items.length === 0) return null;
  return (
    <section className="class-group">
      <div className="section-heading"><h2>{title}</h2><span>{items.length} lớp trong trang đã tải</span></div>
      <div className="class-grid">{items.map((item) => <ClassCard key={item.id} item={item} />)}</div>
    </section>
  );
}

export function ClassesPage() {
  const { me } = useAuth();
  const tutorId = me?.profiles.tutor?.id ?? null;
  const query = useInfiniteQuery({
    queryKey: ["tutor-classes", tutorId],
    queryFn: ({ pageParam }) => classesApi.mine({ role: "tutor", cursor: pageParam ?? undefined, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    enabled: tutorId !== null,
  });
  const items = useMemo(() => query.data?.pages.flatMap((page: KeysetPage<ClassDetail>) => page.items) ?? [], [query.data]);
  const groups = useMemo(() => groupClasses(items), [items]);

  return (
    <>
      <header className="page-heading"><div><p className="eyebrow">Không gian giảng dạy</p><h1>Lớp học</h1><p>Theo dõi lớp đang phụ trách và mở đúng tác vụ theo trạng thái.</p></div></header>
      <div className="class-list-panel">
        {query.isLoading ? <LoadingState label="Đang tải danh sách lớp…" /> :
          query.isError ? <ErrorState title="Không tải được lớp học" message="Dữ liệu lớp tạm thời chưa sẵn sàng." actionLabel="Thử lại" onAction={() => void query.refetch()} /> :
            items.length === 0 ? <EmptyState title="Chưa có lớp học" message="Lớp sẽ xuất hiện sau khi bạn nhận yêu cầu học thử." /> : <>
              <ClassGroup title="Đang phụ trách" items={groups.ongoing} />
              <ClassGroup title="Đã kết thúc" items={groups.ended} />
              {query.hasNextPage && <button className="button secondary class-load-more" type="button" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Đang tải…" : "Tải thêm lớp"}</button>}
            </>}
      </div>
    </>
  );
}
