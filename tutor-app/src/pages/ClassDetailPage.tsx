import type { ClassDetail, ClassTransitionTarget } from "@kimthanh-tutor/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookCheck, CalendarClock, ChevronLeft, ClipboardList, MessageSquareText, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";
import { classesApi } from "../lib/api/classes";
import { ApiClientError } from "../lib/api/errors";
import { classStatusPresentation, classTransitionPresentation, conflictClass } from "../lib/classes/classes";
import { formatUtcForVietnam } from "../lib/format";

function ConfirmTransition({ target, busy, onClose, onConfirm }: { target: ClassTransitionTarget; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const action = classTransitionPresentation(target);
  return <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="class-confirm-title" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">Xác nhận thay đổi trạng thái</p><h2 id="class-confirm-title">{action.confirmation}</h2></div></div><div className="modal-body"><p>Trạng thái lớp sẽ được cập nhật cho cả gia sư và phụ huynh. Nếu dữ liệu vừa thay đổi ở nơi khác, hệ thống sẽ tải trạng thái mới thay vì ghi đè.</p><div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Quay lại</button><button type="button" className={`button ${action.tone}`} disabled={busy} onClick={onConfirm}>{busy ? "Đang cập nhật…" : action.confirmation}</button></div></div></div></div>;
}

export function ClassDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<ClassTransitionTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["class-detail", id], queryFn: () => classesApi.detail(id), enabled: id.length > 0 });
  const mutation = useMutation({
    mutationFn: ({ item, target }: { item: ClassDetail; target: ClassTransitionTarget }) => classesApi.transition(item.id, { to: target, expected_version: item.version }),
    onSuccess: (next) => {
      queryClient.setQueryData(["class-detail", id], next);
      void queryClient.invalidateQueries({ queryKey: ["tutor-classes"] });
      setConfirming(null);
      setNotice("Trạng thái lớp đã được cập nhật.");
    },
    onError: (error: unknown) => {
      if (error instanceof ApiClientError && error.status === 409) {
        const current = conflictClass(error.details);
        if (current) queryClient.setQueryData(["class-detail", id], current);
        setConfirming(null);
        setNotice(current ? `Lớp đã chuyển sang “${classStatusPresentation(current.status).label}” ở thao tác khác. Dữ liệu mới đã được áp dụng.` : "Lớp vừa thay đổi ở thao tác khác. Đang tải lại dữ liệu.");
        if (!current) void query.refetch();
        return;
      }
      setNotice(error instanceof Error ? error.message : "Không thể cập nhật lớp.");
    },
  });

  if (!id) return <EmptyState title="Thiếu mã lớp" message="Hãy mở lớp từ danh sách lớp học." />;
  if (query.isLoading) return <LoadingState label="Đang tải chi tiết lớp…" />;
  if (query.isError || !query.data) return <ErrorState title="Không tải được chi tiết lớp" message="Lớp không tồn tại hoặc không thuộc tài khoản này." actionLabel="Thử lại" onAction={() => void query.refetch()} />;
  const item = query.data;
  const status = classStatusPresentation(item.status);

  function requestTransition(target: ClassTransitionTarget) {
    const action = classTransitionPresentation(target);
    setNotice(null);
    if (action.confirmation) setConfirming(target);
    else mutation.mutate({ item, target });
  }

  return <>
    <Link className="back-link" to="/classes"><ChevronLeft size={16} />Danh sách lớp</Link>
    <header className="page-heading class-detail-heading"><div><p className="eyebrow">Chi tiết lớp</p><h1>{item.subject}</h1><p>{item.student ? `${item.student.name} · Lớp ${item.student.grade}` : "Chưa liên kết học sinh"}</p></div><span className={`profile-status tone-${status.tone}`}>{status.label}</span></header>
    {notice && <div className="trial-notice" role="status"><ShieldCheck size={17} /><span>{notice}</span><button className="text-button" type="button" onClick={() => setNotice(null)}>Đóng</button></div>}
    <div className="class-detail-grid">
      <section className="panel class-info-panel"><div className="section-heading"><h2>Thông tin lớp</h2><span>Phiên bản {item.version}</span></div><dl className="class-detail-list">
        <div><dt>Phụ huynh</dt><dd>{item.parent?.display_name ?? "Chưa liên kết"}</dd></div>
        <div><dt>Hình thức đề xuất</dt><dd>{item.requested_teaching_mode === "online" ? "Online" : item.requested_teaching_mode === "offline" ? "Trực tiếp" : "Chưa có"}</dd></div>
        <div><dt>Lịch đề xuất</dt><dd>{item.requested_schedule ?? "Chưa có"}</dd></div>
        <div><dt>Bắt đầu</dt><dd>{item.started_at ? formatUtcForVietnam(item.started_at) : "Chưa bắt đầu"}</dd></div>
      </dl><p className="class-domain-note"><CalendarClock size={17} />Hình thức và lịch ở trên là đề xuất từ yêu cầu học thử, không phải lịch hợp đồng đã xác nhận. Hệ thống chưa có fee/schedule hợp đồng nên không suy diễn.</p></section>
      <section className="panel class-actions-panel"><div className="section-heading"><h2>Thao tác hợp lệ</h2></div>{item.capabilities.transitions.length ? <div className="class-transition-actions">{item.capabilities.transitions.map((target) => { const action = classTransitionPresentation(target); return <button key={target} type="button" className={`button ${action.tone}`} disabled={mutation.isPending} onClick={() => requestTransition(target)}>{action.label}</button>; })}</div> : <p className="muted-copy">Trạng thái hiện tại không còn thao tác chuyển lớp dành cho gia sư.</p>}
        <div className="class-quick-links">
          {item.capabilities.can_create_lesson_log && <Link to={`/classes/${encodeURIComponent(item.id)}/lesson-logs`}><ClipboardList size={17} />Mở sổ đầu bài</Link>}
          {item.capabilities.can_view_review && <Link to={`/reviews?class_id=${encodeURIComponent(item.id)}`}><MessageSquareText size={17} />Xem đánh giá</Link>}
          {!item.capabilities.can_create_lesson_log && !item.capabilities.can_view_review && <span><BookCheck size={17} />Chưa có tác vụ phụ phù hợp trạng thái.</span>}
        </div>
      </section>
    </div>
    {confirming && <ConfirmTransition target={confirming} busy={mutation.isPending} onClose={() => setConfirming(null)} onConfirm={() => mutation.mutate({ item, target: confirming })} />}
  </>;
}
