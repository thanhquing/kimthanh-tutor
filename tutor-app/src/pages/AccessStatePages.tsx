import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { appConfig } from "../lib/config";

export function LoadingAccessPage() {
  return <main className="access-page"><div className="access-card" role="status"><span className="spinner" /><p>Đang xác thực phiên gia sư…</p></div></main>;
}

export function SessionErrorPage({ message, retry }: { message: string; retry: () => Promise<unknown> }) {
  return <main className="access-page"><section className="access-card"><p className="eyebrow">Kết nối tạm gián đoạn</p><h1>Chưa thể xác minh phiên</h1><p>{message}</p><button className="button primary" type="button" onClick={() => void retry()}>Thử lại</button></section></main>;
}

export function ForbiddenPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const signOut = () => { logout(); navigate("/login", { replace: true }); };
  return <main className="access-page"><section className="access-card"><p className="eyebrow">Sai không gian làm việc</p><h1>Tài khoản không có vai trò gia sư</h1><p>Tài khoản này thuộc không gian phụ huynh. Dữ liệu gia sư chưa được tải.</p><div className="button-row"><a className="button primary" href={appConfig.marketUrl}>Về Chợ gia sư</a><button className="button secondary" type="button" onClick={signOut}>Đăng xuất</button></div></section></main>;
}

export function AccountUnavailablePage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const signOut = () => { logout(); navigate("/login", { replace: true }); };
  return <main className="access-page"><section className="access-card"><p className="eyebrow danger-text">Tài khoản không khả dụng</p><h1>Quyền truy cập đang bị tạm ngưng</h1><p>Workspace và dữ liệu được giữ an toàn. Vui lòng liên hệ bộ phận hỗ trợ để được rà soát.</p><button className="button primary" type="button" onClick={signOut}>Về trang đăng nhập</button></section></main>;
}
