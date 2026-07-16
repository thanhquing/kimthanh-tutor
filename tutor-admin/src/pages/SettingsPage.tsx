import { appConfig } from "../lib/config";

export function SettingsPage() {
  return <><header className="page-heading"><div><p className="eyebrow">Bảo mật</p><h1>Phiên & bảo mật</h1><p>Thông tin kỹ thuật chỉ đọc, không hiển thị token hoặc API base.</p></div></header><section className="panel settings-grid"><article><small>Môi trường bản dựng</small><strong>{appConfig.buildEnvironment}</strong><span>Metadata read-only từ thời điểm build.</span></article><article><small>Idle timeout</small><strong>{Math.round(appConfig.idleTimeoutMs / 60_000)} phút</strong><span>Phiên sẽ được xóa khỏi bộ nhớ khi không hoạt động.</span></article><article><small>Phân tích phiên</small><strong>Tắt</strong><span>Console quản trị không dùng session replay hoặc analytics theo phiên.</span></article></section></>;
}
