import { type FormEvent, useState } from "react";
import { useAuth } from "../app/AuthContext";
import { ApiClientError } from "../lib/api/errors";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!email.trim() || !password) {
      setMessage("Nhập đầy đủ email và mật khẩu.");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      setMessage(error instanceof ApiClientError || error instanceof Error ? error.message : "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card" aria-labelledby="login-title">
    <p className="eyebrow">Kim Thành Tutor · nội bộ</p>
    <h1 id="login-title">Đăng nhập quản trị</h1>
    <p>Chỉ tài khoản nội bộ đã được cấp quyền admin mới có thể truy cập.</p>
    <form onSubmit={submit} className="form-stack">
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" maxLength={254} autoFocus /></label>
      <label>Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={12} maxLength={128} /></label>
      <button className="button primary" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
    </form>
    {message && <p className="form-error" role="alert">{message}</p>}
    <p className="quiet">Phiên tự kết thúc khi không hoạt động. Không chia sẻ thông tin đăng nhập cho người khác.</p>
  </section></main>;
}
