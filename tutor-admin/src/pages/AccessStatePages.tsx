import { Link } from "react-router-dom";
import { useAuth } from "../app/AuthContext";

export function LoadingAccessPage() { return <main className="access-state"><p>Đang xác thực phiên quản trị…</p></main>; }
export function ForbiddenPage() { const { logout } = useAuth(); return <main className="access-state"><div><h1>Không có quyền quản trị</h1><p>Tài khoản này đã xác thực nhưng không có vai trò admin. Dữ liệu vận hành không được tải.</p><button className="button primary" onClick={logout}>Đăng xuất</button></div></main>; }
export function ConsentRequiredPage() { const { logout } = useAuth(); return <main className="access-state"><div><h1>Cần hoàn tất đồng ý pháp lý</h1><p>Tài khoản quản trị này đang ở trạng thái chờ đồng ý. Hãy hoàn tất quy trình pháp lý trước khi mở console vận hành.</p><button className="button primary" onClick={logout}>Đăng xuất</button></div></main>; }
export function SuspendedPage() { const { logout } = useAuth(); return <main className="access-state"><div><h1>Tài khoản đã bị tạm ngưng</h1><p>Phiên này không được phép mở console vận hành. Liên hệ quản trị viên hệ thống nếu cần rà soát.</p><button className="button primary" onClick={logout}>Đăng xuất</button></div></main>; }
export function NotFoundPage() { return <div className="panel"><h1>Không tìm thấy trang</h1><p>Đường dẫn không thuộc console vận hành.</p><Link className="button primary" to="/overview">Về tổng quan</Link></div>; }
