import type { NavigationItem } from "../app/navigation";
import { EmptyState } from "../components/states/EmptyState";

const taskByPath: Record<string, string> = {
  "/dashboard": "TA-04",
  "/profile": "TA-02",
  "/availability": "TA-03",
  "/trials": "TA-05",
  "/classes": "TA-06",
  "/lesson-logs": "TA-07",
  "/reviews": "TA-11",
  "/billing": "TA-09",
  "/payout-accounts": "TA-08",
  "/qr-records": "TA-10",
  "/notifications": "TA-12",
  "/settings": "TA-01",
};

export function PlaceholderPage({ item }: { item: NavigationItem }) {
  return (
    <>
      <header className="page-heading">
        <div><p className="eyebrow">Không gian gia sư</p><h1>{item.label}</h1><p>{item.description}</p></div>
        <span className="status-chip">Nền tảng sẵn sàng</span>
      </header>
      <div className="summary-grid" aria-label="Trạng thái nền tảng">
        <article className="summary-card"><small>Route</small><strong>{item.path}</strong><span>Deep link và refresh được hỗ trợ</span></article>
        <article className="summary-card"><small>Task triển khai</small><strong>{taskByPath[item.path]}</strong><span>Business UI sẽ được tích hợp API theo task</span></article>
        <article className="summary-card"><small>Trạng thái</small><strong>Chưa có dữ liệu</strong><span>Không dùng mock localStorage trong production</span></article>
      </div>
      <div className="panel">
        <EmptyState title={`${item.label} đang chờ triển khai`} message={`Shell, navigation và API foundation đã sẵn sàng. Phạm vi nghiệp vụ của màn này thuộc ${taskByPath[item.path]}.`} />
      </div>
    </>
  );
}
