import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { ApiClientError } from "../lib/api/errors";
import { appConfig } from "../lib/config";
import { loginWithFacebook } from "../lib/oauth";
import { routeAfterAuth, safeNextPath } from "../lib/redirects";

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError || error instanceof Error) return error.message;
  return "Không thể hoàn tất đăng nhập. Vui lòng thử lại.";
}

// Callback OAuth server-side redirect kèm ?oauth_error khi thất bại.
const OAUTH_ERRORS: Record<string, string> = {
  state: "Phiên đăng nhập Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.",
  denied: "Bạn đã hủy đăng nhập Google.",
  failed: "Đăng nhập Google thất bại. Vui lòng thử lại.",
};

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"facebook" | "password" | "resend" | null>(null);
  const [message, setMessage] = useState<string | null>(
    () => OAUTH_ERRORS[searchParams.get("oauth_error") ?? ""] ?? null,
  );
  const [needsVerify, setNeedsVerify] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Đăng nhập Google chạy server-side (Authorization Code): điều hướng cả trang
  // tới BE, không giữ token ở browser. Callback set cookie phiên rồi quay lại FE.
  const googleStartUrl =
    `${appConfig.apiBaseUrl}/auth/oauth/google/start` +
    `?return_to=${encodeURIComponent(window.location.origin)}&next=${encodeURIComponent(next)}`;

  if (auth.accountUnavailable) return <Navigate to="/account-unavailable" replace />;
  if (auth.me) return <Navigate to={routeAfterAuth(auth.me, next)} replace />;

  async function facebookLogin() {
    setBusy("facebook");
    setMessage(null);
    try {
      const accessToken = await loginWithFacebook(appConfig.facebookAppId, appConfig.facebookApiVersion);
      const me = await auth.loginWithFacebookToken(accessToken);
      navigate(routeAfterAuth(me, next), { replace: true });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setNotice(null);
    setNeedsVerify(false);
    if (!email.trim() || !password) {
      setMessage("Nhập đầy đủ email và mật khẩu.");
      return;
    }
    setBusy("password");
    try {
      const me = await auth.login(email.trim(), password);
      navigate(routeAfterAuth(me, next), { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerify(true);
        setMessage("Email chưa được xác thực. Kiểm tra hộp thư hoặc gửi lại liên kết xác thực.");
      } else {
        setMessage(errorMessage(error));
      }
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    setBusy("resend");
    setNotice(null);
    try {
      await auth.resendVerification(email.trim());
      setNotice("Đã gửi lại email xác thực (nếu tài khoản tồn tại và chưa xác thực).");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return <main className="auth-page"><section className="auth-card" aria-labelledby="login-title">
    <div className="auth-brand"><span className="brand-mark" aria-hidden="true">KT</span><div><strong>Kim Thành Tutor</strong><span>Workspace dành cho gia sư</span></div></div>
    <p className="eyebrow">Đăng nhập an toàn</p>
    <h1 id="login-title">Tiếp tục vào workspace</h1>
    <p>Đăng nhập bằng Google hoặc email + mật khẩu.</p>

    <div className="social-stack" aria-busy={busy === "facebook"}>
      <a className="button social" href={googleStartUrl}>Tiếp tục với Google</a>
      <button className="button social facebook" type="button" disabled={!appConfig.facebookAppId || busy !== null} onClick={() => void facebookLogin()}>{busy === "facebook" ? "Đang mở Facebook…" : appConfig.facebookAppId ? "Tiếp tục với Facebook" : "Facebook OAuth sắp có"}</button>
    </div>

    <div className="auth-divider"><span>hoặc email + mật khẩu</span></div>
    <form className="form-stack" onSubmit={submit}>
      <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" maxLength={254} placeholder="ban@gmail.com" autoFocus /></label>
      <label>Mật khẩu<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" maxLength={128} /></label>
      <button className="button primary block" disabled={busy !== null}>{busy === "password" ? "Đang đăng nhập…" : "Đăng nhập"}</button>
    </form>
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    {message && <p className="form-error" role="alert">{message}</p>}
    {needsVerify && <button className="button secondary block" type="button" disabled={busy !== null} onClick={() => void resend()}>{busy === "resend" ? "Đang gửi…" : "Gửi lại email xác thực"}</button>}

    <div className="auth-links">
      <Link to="/forgot-password">Quên mật khẩu?</Link>
      <Link to={`/register${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}>Chưa có tài khoản? Đăng ký</Link>
    </div>
    <p className="auth-footnote">Chỉ chấp nhận email Gmail hoặc email trường học (.edu). Token chỉ giữ trong bộ nhớ của tab hiện tại.</p>
    <a className="market-link" href={appConfig.marketUrl}>← Về Chợ gia sư</a>
  </section></main>;
}
