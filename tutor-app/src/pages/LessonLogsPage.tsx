import type { KeysetPage, LessonLogDetail } from "@kimthanh-tutor/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, ChevronLeft, Clock3, FilePenLine, NotebookPen, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";
import { classesApi } from "../lib/api/classes";
import { lessonLogsApi } from "../lib/api/lesson-logs";
import { formatUtcForVietnam } from "../lib/format";
import {
  ABSORPTION_OPTIONS,
  absorptionLabel,
  emptyLessonLogForm,
  formFromLog,
  inputFromForm,
  mergeLessonPages,
  type LessonLogFormValues,
  updateInputFromForm,
  validateLessonLog,
} from "../lib/lesson-logs/lesson-logs";

type LessonPage = KeysetPage<LessonLogDetail>;
type LessonCache = { pages: LessonPage[]; pageParams: unknown[] };
type EditorState = { mode: "create" } | { mode: "edit"; log: LessonLogDetail };

function LessonLogDialog({ editor, busy, serverError, onClose, onSubmit }: {
  editor: EditorState;
  busy: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (values: LessonLogFormValues) => void;
}) {
  const [values, setValues] = useState<LessonLogFormValues>(() => editor.mode === "edit" ? formFromLog(editor.log) : emptyLessonLogForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  function set<K extends keyof LessonLogFormValues>(key: K, value: LessonLogFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateLessonLog(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(values);
  }

  return <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
    <div className="modal-card lesson-log-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-log-title" onClick={(event) => event.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow">Sổ đầu bài</p><h2 id="lesson-log-title">{editor.mode === "create" ? "Ghi buổi học" : "Sửa buổi học"}</h2></div><button type="button" className="icon-remove" aria-label="Đóng" disabled={busy} onClick={onClose}>×</button></div>
      <form className="modal-body form-stack" onSubmit={submit} noValidate>
        <div className="field-grid">
          <label className="field" htmlFor="lesson-at"><span>Ngày giờ học</span><input id="lesson-at" type="datetime-local" autoFocus value={values.lessonAt} aria-invalid={!!errors.lessonAt} onChange={(event) => set("lessonAt", event.target.value)} />{errors.lessonAt && <em className="field-error">{errors.lessonAt}</em>}</label>
          <label className="field" htmlFor="lesson-subject"><span>Môn/chủ đề</span><input id="lesson-subject" maxLength={80} value={values.subject} aria-invalid={!!errors.subject} onChange={(event) => set("subject", event.target.value)} />{errors.subject && <em className="field-error">{errors.subject}</em>}</label>
        </div>
        <label className="field" htmlFor="lesson-content"><span>Nội dung đã học</span><textarea id="lesson-content" maxLength={4000} value={values.content} aria-invalid={!!errors.content} onChange={(event) => set("content", event.target.value)} /><small className="field-hint">{values.content.length}/4.000 ký tự</small>{errors.content && <em className="field-error">{errors.content}</em>}</label>
        <label className="field" htmlFor="lesson-homework"><span>Bài tập về nhà</span><textarea id="lesson-homework" maxLength={2000} value={values.homework} aria-invalid={!!errors.homework} onChange={(event) => set("homework", event.target.value)} /><small className="field-hint">{values.homework.length}/2.000 ký tự</small>{errors.homework && <em className="field-error">{errors.homework}</em>}</label>
        <label className="field" htmlFor="lesson-absorption"><span>Mức độ tiếp thu</span><select id="lesson-absorption" value={values.absorptionLevel} onChange={(event) => set("absorptionLevel", event.target.value as LessonLogFormValues["absorptionLevel"])}>{ABSORPTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="field" htmlFor="lesson-tutor-note"><span>Nhận xét chia sẻ với phụ huynh</span><textarea id="lesson-tutor-note" maxLength={2000} value={values.tutorNote} aria-invalid={!!errors.tutorNote} onChange={(event) => set("tutorNote", event.target.value)} /><small className="field-hint">Nội dung này hiển thị cho phụ huynh của lớp · {values.tutorNote.length}/2.000 ký tự</small>{errors.tutorNote && <em className="field-error">{errors.tutorNote}</em>}</label>
        {serverError && <p className="form-error" role="alert">{serverError}</p>}
        <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Quay lại</button><button type="submit" className="button primary" disabled={busy}>{busy ? "Đang lưu…" : editor.mode === "create" ? "Lưu buổi học" : "Lưu thay đổi"}</button></div>
      </form>
    </div>
  </div>;
}

function LessonCard({ log, onEdit }: { log: LessonLogDetail; onEdit: () => void }) {
  return <article className="lesson-log-card">
    <div className="lesson-log-head"><div><p className="lesson-log-time"><Clock3 size={15} aria-hidden="true" />{formatUtcForVietnam(log.lesson_at)}</p><h2>{log.subject}</h2></div><span className={`absorption-chip absorption-${log.absorption_level}`}>{absorptionLabel(log.absorption_level)}</span></div>
    <dl className="lesson-log-detail">
      <div><dt>Nội dung đã học</dt><dd>{log.content || "Chưa ghi nội dung"}</dd></div>
      <div><dt>Bài tập về nhà</dt><dd>{log.homework || "Không có bài tập"}</dd></div>
      <div className="lesson-parent-note"><dt>Nhận xét chia sẻ với phụ huynh</dt><dd>{log.tutor_note || "Chưa có nhận xét"}</dd></div>
    </dl>
    <footer className="lesson-log-footer"><small>Cập nhật {formatUtcForVietnam(log.updated_at)}</small>{log.capabilities.can_edit ? <button type="button" className="button secondary small" onClick={onEdit}><FilePenLine size={15} aria-hidden="true" />Sửa buổi học</button> : <span className="lesson-edit-expired"><ShieldCheck size={14} aria-hidden="true" />Đã hết thời hạn chỉnh sửa</span>}</footer>
  </article>;
}

export function LessonLogsPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const classQuery = useQuery({ queryKey: ["class-detail", id], queryFn: () => classesApi.detail(id), enabled: id.length > 0 });
  const logsQuery = useInfiniteQuery({
    queryKey: ["lesson-logs", id],
    queryFn: ({ pageParam }) => lessonLogsApi.list(id, { cursor: pageParam ?? undefined, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    enabled: id.length > 0,
  });
  const logs = useMemo(() => mergeLessonPages(logsQuery.data?.pages), [logsQuery.data]);

  function replaceCached(changed: LessonLogDetail) {
    queryClient.setQueryData<LessonCache>(["lesson-logs", id], (data) => data ? { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map((item) => item.id === changed.id ? changed : item) })) } : data);
  }

  const createMutation = useMutation({
    mutationFn: (values: LessonLogFormValues) => lessonLogsApi.create(id, inputFromForm(values)),
    onSuccess: (created) => {
      queryClient.setQueryData<LessonCache>(["lesson-logs", id], (data) => data
        ? { ...data, pages: data.pages.map((page, index) => index === 0 ? { ...page, items: [created, ...page.items.filter((item) => item.id !== created.id)] } : { ...page, items: page.items.filter((item) => item.id !== created.id) }) }
        : { pages: [{ items: [created], next_cursor: null }], pageParams: [null] });
      setEditor(null);
      setNotice("Đã lưu buổi học và cập nhật sổ đầu bài.");
      void queryClient.invalidateQueries({ queryKey: ["lesson-logs", id] });
      void queryClient.invalidateQueries({ queryKey: ["tutor-dashboard"] });
    },
    onError: (error: unknown) => setServerError(error instanceof Error ? error.message : "Không thể lưu buổi học."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ log, values }: { log: LessonLogDetail; values: LessonLogFormValues }) => lessonLogsApi.update(log.id, updateInputFromForm(values)),
    onSuccess: (changed) => {
      replaceCached(changed);
      setEditor(null);
      setNotice("Đã cập nhật buổi học.");
      void queryClient.invalidateQueries({ queryKey: ["lesson-logs", id] });
      void queryClient.invalidateQueries({ queryKey: ["tutor-dashboard"] });
    },
    onError: (error: unknown) => {
      setServerError(error instanceof Error ? error.message : "Không thể cập nhật buổi học.");
      void logsQuery.refetch();
    },
  });

  if (!id) return <EmptyState title="Thiếu mã lớp" message="Hãy mở sổ đầu bài từ một lớp học." />;
  if (classQuery.isLoading) return <LoadingState label="Đang tải thông tin lớp…" />;
  if (classQuery.isError || !classQuery.data) return <ErrorState title="Không mở được sổ đầu bài" message="Lớp không tồn tại hoặc không thuộc tài khoản này." actionLabel="Thử lại" onAction={() => void classQuery.refetch()} />;
  const klass = classQuery.data;
  const busy = createMutation.isPending || updateMutation.isPending;

  function submit(values: LessonLogFormValues) {
    setServerError(null);
    if (!editor) return;
    if (editor.mode === "create") createMutation.mutate(values);
    else updateMutation.mutate({ log: editor.log, values });
  }

  return <>
    <Link className="back-link" to={`/classes/${encodeURIComponent(id)}`}><ChevronLeft size={16} />Chi tiết lớp</Link>
    <header className="page-heading lesson-log-heading"><div><p className="eyebrow">{klass.student ? `${klass.student.name} · Lớp ${klass.student.grade}` : "Lớp học"}</p><h1>Sổ đầu bài · {klass.subject}</h1><p>Lịch sử buổi học và nhận xét được chia sẻ với phụ huynh.</p></div>{klass.capabilities.can_create_lesson_log && <button type="button" className="button primary" onClick={() => { setServerError(null); setEditor({ mode: "create" }); }}><NotebookPen size={17} aria-hidden="true" />Ghi buổi học</button>}</header>
    {notice && <div className="trial-notice" role="status"><BookOpenCheck size={17} /><span>{notice}</span><button className="text-button" type="button" onClick={() => setNotice(null)}>Đóng</button></div>}
    <section className="lesson-log-panel" aria-label="Các buổi học">
      {logsQuery.isLoading ? <LoadingState label="Đang tải sổ đầu bài…" /> : logsQuery.isError ? <ErrorState title="Không tải được sổ đầu bài" message="Dữ liệu buổi học tạm thời chưa sẵn sàng." actionLabel="Thử lại" onAction={() => void logsQuery.refetch()} /> : logs.length === 0 ? <EmptyState title="Chưa có buổi học" message={klass.capabilities.can_create_lesson_log ? "Ghi buổi học đầu tiên để phụ huynh theo dõi tiến độ." : "Lớp hiện không cho phép tạo thêm sổ đầu bài."} /> : <div className="lesson-log-list">{logs.map((log) => <LessonCard key={log.id} log={log} onEdit={() => { setServerError(null); setEditor({ mode: "edit", log }); }} />)}{logsQuery.hasNextPage && <button type="button" className="button secondary lesson-load-more" disabled={logsQuery.isFetchingNextPage} onClick={() => void logsQuery.fetchNextPage()}>{logsQuery.isFetchingNextPage ? "Đang tải…" : "Tải thêm buổi học"}</button>}</div>}
    </section>
    {editor && <LessonLogDialog editor={editor} busy={busy} serverError={serverError} onClose={() => !busy && setEditor(null)} onSubmit={submit} />}
  </>;
}
