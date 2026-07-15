import { Link } from "react-router-dom";
import { EmptyState } from "../components/states/EmptyState";

export function NotFoundPage() {
  return <div className="panel"><EmptyState title="Không tìm thấy trang" message="Đường dẫn này không tồn tại hoặc đã được thay đổi." action={<Link className="button primary" to="/dashboard">Về Dashboard</Link>} /></div>;
}
