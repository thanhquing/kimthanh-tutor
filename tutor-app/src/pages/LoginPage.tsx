import type { AuthOtpChannel, AuthOtpRequestResponse } from "@kimthanh-tutor/contracts";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { ApiClientError } from "../lib/api/errors";
import { appConfig } from "../lib/config";
import { loginWithFacebook, renderGoogleButton } from "../lib/oauth";
import { routeAfterAuth, safeNextPath } from "../lib/redirects";

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError || error instanceof Error) return error.message;
  return "Không thể hoàn tất đăng nhập. Vui lòng thử lại.";
}

function remainingSeconds(expiresAt: string, now: number) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const googleButton = useRef<HTMLDivElement>(null);
  const [channel, setChannel] = useState<AuthOtpChannel>("sms");
  const [destination, setDestination] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequest, setOtpRequest] = useState<AuthOtpRequestResponse | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<"google" | "facebook" | "otp-request" | "otp-verify" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { loginWithGoogleToken } = auth;
  useEffect(() => {
    if (!googleButton.current || !appConfig.googleClientId) return;
    let active = true;
    renderGoogleButton(
      googleButton.current,
      appConfig.googleClientId,
      (idToken) => {
        if (!active) return;
        setBusy("google");
        setMessage(null);
        void loginWithGoogleToken(idToken)
          .then((me) => navigate(routeAfterAuth(me, next), { replace: true }))
          .catch((error) => setMessage(errorMessage(error)))
          .finally(() => setBusy(null));
      },
      (error) => active && setMessage(error),
    ).catch((error) => active && setMessage(errorMessage(error)));
    return () => { active = false; };
  }, [loginWithGoogleToken, navigate, next]);

  useEffect(() => {
    if (!otpRequest) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [otpRequest]);

  if (auth.accountUnavailable) return <Navigate to="/account-unavailable" replace />;
  if (auth.me) return <Navigate to={routeAfterAuth(auth.me, next)} replace />;

  const secondsLeft = otpRequest ? remainingSeconds(otpRequest.expires_at, now) : 0;

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

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!destination.trim()) {
      setMessage(channel === "sms" ? "Nhập số điện thoại nhận OTP." : "Nhập email đã liên kết tài khoản.");
      return;
    }
    setBusy("otp-request");
    try {
      const response = await auth.requestOtp({ channel, destination: destination.trim() });
      setOtpRequest(response);
      setOtp("");
      setNow(Date.now());
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    if (!otpRequest || secondsLeft === 0) {
      setMessage("Mã OTP đã hết hạn. Vui lòng gửi mã mới.");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setMessage("OTP gồm đúng 6 chữ số.");
      return;
    }
    setBusy("otp-verify");
    setMessage(null);
    try {
      const me = await auth.verifyOtp(otpRequest.request_id, otp);
      navigate(routeAfterAuth(me, next), { replace: true });
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
    <p>Google hoặc Facebook là lựa chọn chính. OTP dùng làm phương án dự phòng.</p>

    <div className="social-stack" aria-busy={busy === "google" || busy === "facebook"}>
      {appConfig.googleClientId ? <div ref={googleButton} className="google-button-host" aria-label="Tiếp tục với Google" /> : <button className="button social" type="button" disabled>Google OAuth chưa cấu hình</button>}
      <button className="button social facebook" type="button" disabled={!appConfig.facebookAppId || busy !== null} onClick={() => void facebookLogin()}>{busy === "facebook" ? "Đang mở Facebook…" : appConfig.facebookAppId ? "Tiếp tục với Facebook" : "Facebook OAuth chưa cấu hình"}</button>
    </div>

    <div className="auth-divider"><span>hoặc dùng OTP dự phòng</span></div>
    {!otpRequest ? <form className="form-stack" onSubmit={requestOtp}>
      <label>Kênh nhận mã<select value={channel} onChange={(event) => { setChannel(event.target.value as AuthOtpChannel); setDestination(""); }}><option value="sms">Tin nhắn SMS</option><option value="email">Email đã liên kết</option></select></label>
      <label>{channel === "sms" ? "Số điện thoại" : "Email"}<input value={destination} onChange={(event) => setDestination(event.target.value)} type={channel === "email" ? "email" : "tel"} autoComplete={channel === "email" ? "email" : "tel"} placeholder={channel === "sms" ? "0912 345 678" : "ban@example.com"} /></label>
      <button className="button primary block" disabled={busy !== null}>{busy === "otp-request" ? "Đang gửi mã…" : "Gửi mã OTP"}</button>
    </form> : <form className="form-stack otp-panel" onSubmit={verifyOtp}>
      <div className="otp-summary"><span>Đã gửi mã tới <strong>{destination}</strong></span><button type="button" className="text-button" onClick={() => { setOtpRequest(null); setMessage(null); }}>Đổi thông tin</button></div>
      <label>Mã OTP<input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" autoFocus /></label>
      <p className={secondsLeft > 0 ? "otp-time" : "form-error"}>{secondsLeft > 0 ? `Mã còn hiệu lực ${secondsLeft} giây.` : "Mã đã hết hạn."}</p>
      {appConfig.devDiagnostics && otpRequest.dev_code && <p className="dev-note">Mã local: <code>{otpRequest.dev_code}</code></p>}
      <button className="button primary block" disabled={busy !== null || secondsLeft === 0}>{busy === "otp-verify" ? "Đang xác minh…" : "Xác nhận OTP"}</button>
      {secondsLeft === 0 && <button className="button secondary block" type="button" onClick={() => setOtpRequest(null)}>Gửi mã mới</button>}
    </form>}
    {message && <p className="form-error" role="alert">{message}</p>}
    <p className="auth-footnote">Không có đăng nhập bằng mật khẩu cho tài khoản gia sư. Token chỉ được giữ trong bộ nhớ của tab hiện tại.</p>
    <a className="market-link" href={appConfig.marketUrl}>← Về Chợ gia sư</a>
  </section></main>;
}
