import type {
  TutorDashboardOverview,
  TutorDashboardSection,
} from "@kimthanh-tutor/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  Landmark,
  NotebookPen,
  QrCode,
  RefreshCw,
  UserRoundPen,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { dashboardApi } from "../lib/api/dashboard";
import {
  profileStatusPresentation,
  qrSubscriptionPresentation,
  sectionFailed,
} from "../lib/dashboard/dashboard";
import { formatUtcForVietnam, formatVnd } from "../lib/format";

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/).at(-1) || "bạn";
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="dashboard-inline-error" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <span>Dữ liệu mục này tạm thời chưa tải được.</span>
      <button type="button" className="text-button" onClick={onRetry}>Thử lại</button>
    </div>
  );
}

function DashboardPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "mute",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "ok" | "warn" | "danger" | "mute" | "pending";
}) {
  return (
    <article className="dashboard-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={`dashboard-stat-hint tone-text-${tone}`}>{hint}</small>
    </article>
  );
}

function sectionValue(
  data: TutorDashboardOverview,
  section: TutorDashboardSection,
  value: number,
): string {
  return sectionFailed(data, section) ? "—" : String(value);
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Đang tải dashboard">
      <div className="dashboard-skeleton-heading skeleton"><span /><span /></div>
      <div className="dashboard-stats">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="dashboard-stat skeleton"><span /><span /><span /></div>)}
      </div>
      <div className="dashboard-grid">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="dashboard-panel skeleton"><span /><span /><span /></div>)}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { me } = useAuth();
  const tutorId = me?.profiles.tutor?.id ?? null;
  const overviewQuery = useQuery({
    queryKey: ["tutor-dashboard-overview", tutorId],
    queryFn: () => dashboardApi.tutorOverview(),
    enabled: tutorId !== null,
  });

  if (overviewQuery.isLoading || !tutorId) {
    return <DashboardSkeleton />;
  }
  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <div className="panel">
        <ErrorState
          title="Không tải được dashboard"
          message="Công việc của bạn tạm thời chưa tải được. Phiên đăng nhập vẫn được giữ an toàn."
          actionLabel="Thử lại"
          onAction={() => void overviewQuery.refetch()}
        />
      </div>
    );
  }

  const data = overviewQuery.data;
  const profile = profileStatusPresentation(data.profile.status);
  const subscription = qrSubscriptionPresentation(data);
  const retry = () => void overviewQuery.refetch();
  const canWriteAnyLog = data.teaching_classes.some((item) => item.can_create_lesson_log);
  const qrSubscriptionUnavailable = sectionFailed(data, "qr_subscription");

  return (
    <>
      <header className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Việc cần làm hôm nay</p>
          <h1>Chào {firstName(data.profile.display_name)} 👋</h1>
          <p>Ưu tiên yêu cầu mới, theo dõi lớp và các QR học phí đang chờ thu.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="button secondary" to="/availability"><CalendarDays size={16} />Cập nhật lịch rảnh</Link>
          {canWriteAnyLog && (
            <Link className="button primary" to="/lesson-logs"><NotebookPen size={16} />Ghi sổ đầu bài</Link>
          )}
        </div>
      </header>

      {data.partial_errors.length > 0 && (
        <div className="dashboard-partial-banner" role="status">
          <RefreshCw size={17} aria-hidden="true" />
          <span>Một vài mục đang gián đoạn; các mục còn lại vẫn là dữ liệu mới nhất.</span>
          <button type="button" className="text-button" onClick={retry}>Tải lại</button>
        </div>
      )}

      <section className="dashboard-stats" aria-label="Tổng quan công việc">
        <StatCard label="Hồ sơ" value={profile.label} hint={profile.hint} tone={profile.tone} />
        <StatCard
          label="Học thử chờ"
          value={sectionValue(data, "pending_trials", data.summary.pending_trials)}
          hint={sectionFailed(data, "pending_trials") ? "Tạm thời chưa tải được" : "Yêu cầu mới cần phản hồi"}
          tone={data.summary.pending_trials > 0 ? "warn" : "mute"}
        />
        <StatCard
          label="Lớp đang dạy"
          value={sectionValue(data, "teaching_classes", data.summary.teaching_classes)}
          hint={sectionFailed(data, "teaching_classes") ? "Tạm thời chưa tải được" : "Gồm lớp học thử đã nhận"}
        />
        <StatCard
          label="Gói QR"
          value={qrSubscriptionUnavailable ? "—" : subscription.label}
          hint={qrSubscriptionUnavailable ? "Tạm thời chưa tải được" : subscription.hint}
          tone={qrSubscriptionUnavailable ? "mute" : subscription.tone}
        />
      </section>

      <div className="dashboard-grid">
        <DashboardPanel
          title="Yêu cầu học thử cần phản hồi"
          action={<Link className="button secondary small" to="/trials">Xem tất cả</Link>}
        >
          {sectionFailed(data, "pending_trials") ? (
            <SectionError onRetry={retry} />
          ) : data.pending_trials.length === 0 ? (
            <EmptyState title="Không có yêu cầu chờ" message="Bạn có thể cập nhật hồ sơ và lịch rảnh để tăng cơ hội nhận lớp." />
          ) : (
            <ul className="dashboard-list">
              {data.pending_trials.map((trial) => (
                <li key={trial.id}>
                  <div>
                    <strong>{trial.subject}</strong>
                    <span>{trial.grade ? `Lớp ${trial.grade}` : "Chưa chọn lớp"} · {trial.teaching_mode === "online" ? "Online" : trial.teaching_mode === "offline" ? "Trực tiếp" : "Chưa chọn hình thức"}</span>
                    <small>Gửi lúc {formatUtcForVietnam(trial.created_at)}</small>
                  </div>
                  <Link className="button primary small" to="/trials">Xử lý</Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Hoạt động lớp gần đây"
          action={<Link className="button secondary small" to="/classes">Xem lớp</Link>}
        >
          {sectionFailed(data, "teaching_classes") ? (
            <SectionError onRetry={retry} />
          ) : data.teaching_classes.length === 0 ? (
            <EmptyState title="Chưa có lớp đang dạy" message="Lớp xuất hiện tại đây sau khi bạn nhận yêu cầu học thử." />
          ) : (
            <ul className="dashboard-list">
              {data.teaching_classes.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.subject}</strong>
                    <span>{item.status === "trial_accepted" ? "Đã nhận học thử" : "Đang hoạt động"}</span>
                    <small>{item.latest_lesson ? `Hoạt động gần nhất ${formatUtcForVietnam(item.latest_lesson.lesson_at)}` : "Chưa có sổ đầu bài"}</small>
                  </div>
                  {item.can_create_lesson_log && (
                    <Link className="button primary small" to={`/lesson-logs?classId=${encodeURIComponent(item.id)}`}>Ghi sổ</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="QR học phí chờ thu"
          action={<Link className="button secondary small" to="/qr-records">Quản lý QR</Link>}
        >
          {sectionFailed(data, "pending_qr_records") ? (
            <SectionError onRetry={retry} />
          ) : data.pending_qr_records.length === 0 ? (
            <EmptyState title="Không có QR chờ thu" message="Bản ghi ở đây chỉ là trạng thái gia sư tự theo dõi; nền tảng không xác nhận dòng tiền học phí." />
          ) : (
            <ul className="dashboard-list">
              {data.pending_qr_records.map((record) => (
                <li key={record.id}>
                  <div>
                    <strong>{formatVnd(record.amount)}</strong>
                    <span>Chờ gia sư tự đối chiếu</span>
                    <small>Tạo lúc {formatUtcForVietnam(record.created_at)}</small>
                  </div>
                  <Link className="button secondary small" to="/qr-records">Xem</Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>

        <DashboardPanel title="Thao tác nhanh">
          <div className="dashboard-actions">
            {data.profile.status !== "published" && data.profile.status !== "suspended" && (
              <Link to="/profile"><UserRoundPen size={18} />Hoàn thiện hồ sơ</Link>
            )}
            <Link to="/availability"><CalendarDays size={18} />Cập nhật lịch rảnh</Link>
            <Link to="/trials"><ClipboardList size={18} />Xem yêu cầu học thử</Link>
            <Link to="/classes"><BookOpen size={18} />Xem các lớp</Link>
            {canWriteAnyLog && <Link to="/lesson-logs"><WalletCards size={18} />Ghi sổ đầu bài</Link>}
            {!data.capabilities.has_payout_account && <Link to="/payout-accounts"><Landmark size={18} />Thêm tài khoản nhận tiền</Link>}
            {!qrSubscriptionUnavailable && !data.capabilities.has_active_qr_access && <Link to="/billing"><QrCode size={18} />Kích hoạt gói QR</Link>}
            {!qrSubscriptionUnavailable && data.capabilities.can_create_qr && <Link to="/qr-records"><QrCode size={18} />Tạo QR học phí</Link>}
          </div>
        </DashboardPanel>
      </div>
    </>
  );
}
