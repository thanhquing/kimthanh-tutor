import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { ApiClientError } from "../lib/api/errors";
import { safeNextPath } from "../lib/redirects";

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError || error instanceof Error) return error.message;
  return "Đã có lỗi xảy ra. Vui lòng thử lại.";
}

function AuthShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <main className="auth-page"><section className="auth-card" aria-labelledby="auth-title">
    <div className="auth-brand"><span className="brand-mark" aria-hidden="true">KT</span><div><strong>Kim Thành Tutor</strong><span>Workspace dành cho gia sư</span></div></div>
    <p className="eyebrow">{eyebrow}</p>
    <h1 id="auth-title">{title}</h1>
    {children}
  </section></main>;
}

export function RegisterPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<{ devLink?: string } | null>(null);

  if (auth.me) return <Navigate to={next} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!email.trim() || !password) { setMessage("Nhập đầy đủ email và mật khẩu."); return; }
    if (password !== confirm) { setMessage("Mật khẩu nhập lại không khớp."); return; }
    setBusy(true);
    try {
      const result = await auth.register(email.trim(), password);
      setDone({ devLink: result.dev_verification_link });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <AuthShell eyebrow="Xác thực email" title="Kiểm tra hộp thư của bạn">
      <p>Chúng tôi đã gửi liên kết xác thực tới <strong>{email.trim()}</strong>. Nhấn liên kết trong email để kích hoạt tài khoản, sau đó đăng nhập.</p>
      {done.devLink && <p className="dev-note">Liên kết xác thực (dev): <a href={done.devLink}>{done.devLink}</a></p>}
      <div className="auth-links"><Link to="/login">← Về đăng nhập</Link></div>
    </AuthShell>;
  }

  return <AuthShell eyebrow="Tạo tài khoản" title="Đăng ký gia sư">
    <p>Chỉ chấp nhận email Gmail hoặc email trường học (.edu). Bạn sẽ cần xác thực email trước khi đăng nhập.</p>
    <form className="form-stack" onSubmit={submit}>
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" maxLength={254} placeholder="ban@gmail.com" autoFocus /></label>
      <label>Mật khẩu<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={8} maxLength={128} /></label>
      <label>Nhập lại mật khẩu<input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" minLength={8} maxLength={128} /></label>
      <button className="button primary block" disabled={busy}>{busy ? "Đang tạo tài khoản…" : "Đăng ký"}</button>
    </form>
    {message && <p className="form-error" role="alert">{message}</p>}
    <div className="auth-links"><Link to="/login">Đã có tài khoản? Đăng nhập</Link></div>
  </AuthShell>;
}

export function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<{ devLink?: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!email.trim()) { setMessage("Nhập email của bạn."); return; }
    setBusy(true);
    try {
      const result = await auth.forgotPassword(email.trim());
      setDone({ devLink: result.dev_reset_link });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <AuthShell eyebrow="Đặt lại mật khẩu" title="Kiểm tra hộp thư của bạn">
      <p>Nếu tài khoản tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu tới email của bạn. Liên kết hết hạn sau một giờ.</p>
      {done.devLink && <p className="dev-note">Liên kết đặt lại (dev): <a href={done.devLink}>{done.devLink}</a></p>}
      <div className="auth-links"><Link to="/login">← Về đăng nhập</Link></div>
    </AuthShell>;
  }

  return <AuthShell eyebrow="Quên mật khẩu" title="Đặt lại mật khẩu">
    <p>Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để bạn tạo mật khẩu mới.</p>
    <form className="form-stack" onSubmit={submit}>
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" maxLength={254} autoFocus /></label>
      <button className="button primary block" disabled={busy}>{busy ? "Đang gửi…" : "Gửi liên kết đặt lại"}</button>
    </form>
    {message && <p className="form-error" role="alert">{message}</p>}
    <div className="auth-links"><Link to="/login">← Về đăng nhập</Link></div>
  </AuthShell>;
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!token) { setMessage("Liên kết không hợp lệ."); return; }
    if (password !== confirm) { setMessage("Mật khẩu nhập lại không khớp."); return; }
    setBusy(true);
    try {
      await auth.resetPassword(token, password);
      setDone(true);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <AuthShell eyebrow="Đặt lại mật khẩu" title="Đã đổi mật khẩu">
      <p>Mật khẩu của bạn đã được cập nhật. Mọi phiên cũ đã bị đăng xuất.</p>
      <div className="auth-links"><Link to="/login">Đăng nhập với mật khẩu mới</Link></div>
    </AuthShell>;
  }

  return <AuthShell eyebrow="Đặt lại mật khẩu" title="Tạo mật khẩu mới">
    {!token && <p className="form-error" role="alert">Liên kết thiếu mã hợp lệ. Hãy yêu cầu liên kết mới.</p>}
    <form className="form-stack" onSubmit={submit}>
      <label>Mật khẩu mới<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={8} maxLength={128} autoFocus /></label>
      <label>Nhập lại mật khẩu<input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" minLength={8} maxLength={128} /></label>
      <button className="button primary block" disabled={busy || !token}>{busy ? "Đang cập nhật…" : "Đặt lại mật khẩu"}</button>
    </form>
    {message && <p className="form-error" role="alert">{message}</p>}
    <div className="auth-links"><Link to="/forgot-password">Yêu cầu liên kết mới</Link></div>
  </AuthShell>;
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const auth = useAuth();
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) { setState("error"); setMessage("Liên kết thiếu mã hợp lệ."); return; }
    auth.verifyEmail(token)
      .then(() => setState("ok"))
      .catch((error) => { setState("error"); setMessage(errorMessage(error)); });
  }, [auth, token]);

  return <AuthShell eyebrow="Xác thực email" title={state === "ok" ? "Email đã xác thực" : state === "error" ? "Không xác thực được" : "Đang xác thực…"}>
    {state === "pending" && <p>Vui lòng đợi trong giây lát…</p>}
    {state === "ok" && <><p>Email của bạn đã được xác thực. Bạn có thể đăng nhập ngay.</p><div className="auth-links"><Link to="/login">Đăng nhập</Link></div></>}
    {state === "error" && <><p className="form-error" role="alert">{message}</p><div className="auth-links"><Link to="/login">← Về đăng nhập</Link></div></>}
  </AuthShell>;
}
