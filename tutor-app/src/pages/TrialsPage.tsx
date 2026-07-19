import type {
  KeysetPage,
  TrialRequestSummary,
  TrialStatus,
} from "@kimthanh-tutor/contracts";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { CalendarClock, CircleAlert, ClipboardCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";
import { ApiClientError } from "../lib/api/errors";
import { trialsApi } from "../lib/api/trials";
import { formatUtcForVietnam } from "../lib/format";
import {
  activationPresentation,
  conflictTrial,
  TRIAL_FILTERS,
  trialStatusPresentation,
  validateDeclineReason,
} from "../lib/trials/trials";

type TrialPage = KeysetPage<TrialRequestSummary>;
type FilterValue = "all" | TrialStatus;

function replaceTrial(
  pages: TrialPage[] | undefined,
  changed: TrialRequestSummary,
): TrialPage[] | undefined {
  return pages?.map((page) => ({
    ...page,
    items: page.items.map((item) => item.id === changed.id ? changed : item),
  }));
}

function DeclineDialog({
  trial,
  submitting,
  onClose,
  onConfirm,
}: {
  trial: TrialRequestSummary;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, submitting]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateDeclineReason(reason);
    setError(validation);
    if (validation) return;
    onConfirm(reason.trim());
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !submitting && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="decline-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Yêu cầu {trial.subject}</p>
            <h2 id="decline-title">Lý do từ chối</h2>
          </div>
          <button type="button" className="icon-remove" aria-label="Đóng" disabled={submitting} onClick={onClose}>×</button>
        </div>
        <form className="modal-body form-stack" onSubmit={submit}>
          <label className="field" htmlFor="decline-reason">
            <span>Lý do gửi phụ huynh</span>
            <textarea
              id="decline-reason"
              autoFocus
              value={reason}
              maxLength={500}
              aria-invalid={!!error}
              placeholder="Vd: Khung giờ mong muốn chưa phù hợp với lịch hiện tại…"
              onChange={(event) => { setReason(event.target.value); setError(null); }}
            />
            <small className="field-hint">Nội dung được trim trước khi gửi · {reason.length}/500</small>
            {error && <em className="field-error">{error}</em>}
          </label>
          <div className="modal-actions">
            <button type="button" className="button secondary" disabled={submitting} onClick={onClose}>Quay lại</button>
            <button type="submit" className="button danger" disabled={submitting}>{submitting ? "Đang từ chối…" : "Xác nhận từ chối"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TrialCard({
  trial,
  busy,
  onAccept,
  onDecline,
}: {
  trial: TrialRequestSummary;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const status = trialStatusPresentation(trial.status);
  const activation = activationPresentation(trial);
  const canAct = trial.capabilities.can_accept || trial.capabilities.can_decline;

  return (
    <article className="trial-card" data-status={trial.status}>
      <div className="trial-card-main">
        <div className="trial-card-copy">
          <div className="trial-title-row">
            <h2>{trial.subject}</h2>
            <span className={`profile-status tone-${status.tone}`}>{status.label}</span>
          </div>
          <p className="trial-meta">
            {trial.grade ? `Khối/lớp ${trial.grade}` : "Chưa chọn khối/lớp"}
            {trial.teaching_mode ? ` · ${trial.teaching_mode === "online" ? "Online" : "Trực tiếp"}` : " · Chưa chọn hình thức"}
          </p>
          <small>Gửi lúc {formatUtcForVietnam(trial.created_at)} · Phiên bản {trial.version}</small>
        </div>
        {canAct && (
          <div className="trial-actions">
            <button type="button" className="button primary" disabled={busy} onClick={onAccept}>
              {busy ? "Đang xử lý…" : "Nhận dạy thử"}
            </button>
            <button type="button" className="button danger" disabled={busy} onClick={onDecline}>Từ chối</button>
          </div>
        )}
      </div>

      {trial.class_contract_id && (
        <div className="trial-result tone-ok" role="status">
          <ClipboardCheck size={18} aria-hidden="true" />
          <span>Lớp học thử đã được tạo.</span>
          <Link to={`/classes/${encodeURIComponent(trial.class_contract_id)}`}>Mở lớp <ExternalLink size={14} /></Link>
        </div>
      )}
      {activation && <p className="trial-activation"><ShieldCheck size={16} aria-hidden="true" />{activation}</p>}

      <details className="trial-detail">
        <summary>Xem chi tiết yêu cầu</summary>
        <dl>
          <div><dt>Mục tiêu học</dt><dd>{trial.learning_goal || "Chưa cung cấp"}</dd></div>
          <div><dt>Lịch mong muốn</dt><dd>{trial.preferred_schedule || "Chưa cung cấp"}</dd></div>
          <div><dt>Lời nhắn</dt><dd>{trial.message || "Không có lời nhắn"}</dd></div>
          {trial.decline_reason && <div><dt>Lý do từ chối</dt><dd>{trial.decline_reason}</dd></div>}
        </dl>
        {trial.preferred_schedule && (
          <p className="trial-schedule-note">
            <CalendarClock size={17} aria-hidden="true" />
            Hệ thống chưa thể tự xác nhận trùng lịch từ nội dung tự do này. Hãy đối chiếu với <Link to="/availability">lịch rảnh/bận</Link> trước khi nhận.
          </p>
        )}
        {!trial.capabilities.can_view_contact && (
          <p className="trial-contact-note">
            <ShieldCheck size={17} aria-hidden="true" />
            Thông tin liên hệ đang được ẩn vì chính sách chia sẻ chưa chốt. Không có dữ liệu liên hệ nào được tải vào màn hình này.
          </p>
        )}
      </details>
    </article>
  );
}

export function TrialsPage() {
  const { me } = useAuth();
  const tutorId = me?.profiles.tutor?.id ?? null;
  const [filter, setFilter] = useState<FilterValue>("all");
  const [declining, setDeclining] = useState<TrialRequestSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [trialOverrides, setTrialOverrides] = useState<Record<string, TrialRequestSummary>>({});
  const queryClient = useQueryClient();

  const trialsQuery = useInfiniteQuery({
    queryKey: ["tutor-trials", tutorId, filter],
    queryFn: ({ pageParam }) => trialsApi.mine({
      role: "tutor",
      status: filter === "all" ? undefined : filter,
      cursor: pageParam ?? undefined,
      limit: 20,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: tutorId !== null,
  });

  const items = useMemo(
    () => (trialsQuery.data?.pages.flatMap((page) => page.items) ?? [])
      .map((item) => trialOverrides[item.id] ?? item)
      .filter((item) => filter === "all" || item.status === filter),
    [filter, trialOverrides, trialsQuery.data],
  );

  function applyServerTrial(changed: TrialRequestSummary) {
    setTrialOverrides((current) => ({ ...current, [changed.id]: changed }));
    queryClient.setQueriesData<{ pages: TrialPage[]; pageParams: unknown[] }>(
      { queryKey: ["tutor-trials", tutorId] },
      (data) => data ? { ...data, pages: replaceTrial(data.pages, changed) ?? data.pages } : data,
    );
  }

  function handleMutationError(error: unknown) {
    if (error instanceof ApiClientError && error.status === 409) {
      const current = conflictTrial(error.details);
      if (current) applyServerTrial(current);
      setDeclining(null);
      setNotice(current
        ? `Yêu cầu đã chuyển sang “${trialStatusPresentation(current.status).label}” ở thao tác khác. Dữ liệu mới đã được cập nhật.`
        : "Yêu cầu vừa được xử lý ở thao tác khác. Đang tải lại trạng thái mới.");
      void queryClient.invalidateQueries({ queryKey: ["tutor-trials", tutorId] });
      return;
    }
    setNotice(error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.");
  }

  const acceptMutation = useMutation({
    mutationFn: (trial: TrialRequestSummary) => trialsApi.accept(trial.id, { expected_version: trial.version }),
    onSuccess: (result) => {
      applyServerTrial(result.trial);
      setNotice("Đã nhận yêu cầu. Lớp học thử và trạng thái kích hoạt được hiển thị ngay bên dưới.");
      void queryClient.invalidateQueries({ queryKey: ["tutor-trials", tutorId] });
    },
    onError: handleMutationError,
  });
  const declineMutation = useMutation({
    mutationFn: ({ trial, reason }: { trial: TrialRequestSummary; reason: string }) =>
      trialsApi.decline(trial.id, { reason, expected_version: trial.version }),
    onSuccess: (result) => {
      applyServerTrial(result);
      setDeclining(null);
      setNotice("Đã từ chối yêu cầu và lưu lý do gửi phụ huynh.");
      void queryClient.invalidateQueries({ queryKey: ["tutor-trials", tutorId] });
    },
    onError: handleMutationError,
  });
  const busyId = acceptMutation.isPending
    ? acceptMutation.variables?.id
    : declineMutation.isPending
      ? declineMutation.variables?.trial.id
      : null;

  return (
    <>
      <header className="page-heading trial-heading">
        <div>
          <p className="eyebrow">Hộp thư công việc</p>
          <h1>Yêu cầu học thử</h1>
          <p>Đọc kỹ lịch mong muốn và phản hồi từng yêu cầu đang chờ.</p>
        </div>
        <Link className="button secondary" to="/availability"><CalendarClock size={16} />Kiểm tra lịch</Link>
      </header>

      <nav className="trial-filters" aria-label="Lọc yêu cầu theo trạng thái">
        {TRIAL_FILTERS.map((item) => (
          <button
            type="button"
            key={item.value}
            className={filter === item.value ? "chip on" : "chip"}
            aria-pressed={filter === item.value}
            onClick={() => { setFilter(item.value); setNotice(null); }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {notice && (
        <div className="trial-notice" role="status">
          <CircleAlert size={17} aria-hidden="true" />
          <span>{notice}</span>
          <button type="button" className="text-button" onClick={() => setNotice(null)}>Đóng</button>
        </div>
      )}

      <section className="trial-list-panel" aria-live="polite">
        {trialsQuery.isLoading ? (
          <LoadingState label="Đang tải yêu cầu học thử…" />
        ) : trialsQuery.isError ? (
          <ErrorState
            title="Không tải được hộp thư"
            message="Yêu cầu học thử tạm thời chưa tải được. Phiên đăng nhập vẫn được giữ an toàn."
            actionLabel="Thử lại"
            onAction={() => void trialsQuery.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState title="Không có yêu cầu" message="Chưa có yêu cầu học thử ở trạng thái này." />
        ) : (
          <div className="trial-list">
            {items.map((trial) => (
              <TrialCard
                key={trial.id}
                trial={trial}
                busy={busyId === trial.id}
                onAccept={() => { setNotice(null); acceptMutation.mutate(trial); }}
                onDecline={() => { setNotice(null); setDeclining(trial); }}
              />
            ))}
            {trialsQuery.hasNextPage && (
              <button
                type="button"
                className="button secondary trial-load-more"
                disabled={trialsQuery.isFetchingNextPage}
                onClick={() => void trialsQuery.fetchNextPage()}
              >
                {trialsQuery.isFetchingNextPage ? "Đang tải…" : "Tải thêm yêu cầu"}
              </button>
            )}
          </div>
        )}
      </section>

      {declining && (
        <DeclineDialog
          trial={declining}
          submitting={declineMutation.isPending}
          onClose={() => setDeclining(null)}
          onConfirm={(reason) => declineMutation.mutate({ trial: declining, reason })}
        />
      )}
    </>
  );
}
