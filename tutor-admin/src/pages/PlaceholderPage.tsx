import type { NavigationItem } from "../app/navigation";

export function PlaceholderPage({ item }: { item: NavigationItem }) {
  return <><header className="page-heading"><div><p className="eyebrow">Console vận hành</p><h1>{item.label}</h1><p>{item.description}</p></div><span className="status-chip">Shell sẵn sàng</span></header>
    <section className="panel"><h2>Đang chờ triển khai nghiệp vụ</h2><p>Route này đã được bảo vệ bằng phiên và role admin. Bề mặt dữ liệu, mutation và audit thuộc task {item.task}; hiện chưa tải dữ liệu giả hoặc mock localStorage.</p></section></>;
}
