"use client";

import type { AuthMeResponse } from "@kimthanh-tutor/contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthProvider";
import { safeInternalNext } from "@/lib/guards";

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError || error instanceof Error) return error.message;
  return "Đã có lỗi xảy ra. Vui lòng thử lại.";
}

// Callback OAuth server-side redirect kèm ?oauth_error khi thất bại.
const OAUTH_ERRORS: Record<string, string> = {
  state: "Phiên đăng nhập Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.",
  denied: "Bạn đã hủy đăng nhập Google.",
  failed: "Đăng nhập Google thất bại. Vui lòng thử lại.",
};

function routeAfterAuth(me: AuthMeResponse, next: string) {
  if (me.user.status === "suspended" || me.user.status === "deleted") return "/account-unavailable";
  if (me.user.status === "pending_consent") return "/consent";
  return next;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">Kim Thành Tutor</p>
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}

export function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeInternalNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    () => OAUTH_ERRORS[params.get("oauth_error") ?? ""] ?? null,
  );
  const [needsVerify, setNeedsVerify] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Google đăng nhập server-side: điều hướng cả trang tới BE. Dựng href sau khi
  // mount để lấy origin (SSR không có window); callback set cookie rồi quay lại.
  const [googleStartUrl, setGoogleStartUrl] = useState<string | null>(null);
  useEffect(() => {
    setGoogleStartUrl(
      `/api/v1/auth/oauth/google/start` +
        `?return_to=${encodeURIComponent(window.location.origin)}&next=${encodeURIComponent(next)}`,
    );
  }, [next]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setNotice(null);
    setNeedsVerify(false);
    if (!email.trim() || !password) { setMessage("Nhập đầy đủ email và mật khẩu."); return; }
    setBusy(true);
    try {
      const me = await auth.login(email.trim(), password);
      router.replace(routeAfterAuth(me, next));
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerify(true);
        setMessage("Email chưa được xác thực. Kiểm tra hộp thư hoặc gửi lại liên kết xác thực.");
      } else {
        setMessage(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setNotice(null);
    try {
      await auth.resendVerification(email.trim());
      setNotice("Đã gửi lại email xác thực (nếu tài khoản tồn tại và chưa xác thực).");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Đăng nhập">
      <p className="auth-sub">Đăng nhập bằng Google hoặc email + mật khẩu.</p>
      {googleStartUrl && <a className="button social" href={googleStartUrl}>Tiếp tục với Google</a>}
      <div className="auth-divider"><span>hoặc email + mật khẩu</span></div>
      <form className="auth-form" onSubmit={submit}>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="ban@gmail.com" /></label>
        <label>Mật khẩu<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" /></label>
        <button className="button primary" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
      </form>
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      {message && <p className="auth-error" role="alert">{message}</p>}
      {needsVerify && <button className="button" type="button" disabled={busy} onClick={() => void resend()}>Gửi lại email xác thực</button>}
      <div className="auth-links">
        <Link href="/forgot-password">Quên mật khẩu?</Link>
        <Link href="/register">Chưa có tài khoản? Đăng ký</Link>
      </div>
    </Shell>
  );
}

export function RegisterForm() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<{ devLink?: string } | null>(null);

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
    return (
      <Shell title="Kiểm tra hộp thư của bạn">
        <p className="auth-sub">Đã gửi liên kết xác thực tới <strong>{email.trim()}</strong>. Nhấn liên kết trong email để kích hoạt tài khoản, rồi đăng nhập.</p>
        {done.devLink && <p className="auth-dev">Liên kết (dev): <a href={done.devLink}>{done.devLink}</a></p>}
        <div className="auth-links"><Link href="/login">← Về đăng nhập</Link></div>
      </Shell>
    );
  }

  return (
    <Shell title="Đăng ký phụ huynh">
      <p className="auth-sub">Chỉ chấp nhận email Gmail hoặc email trường học (.edu). Cần xác thực email trước khi đăng nhập.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="ban@gmail.com" /></label>
        <label>Mật khẩu<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={8} /></label>
        <label>Nhập lại mật khẩu<input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" minLength={8} /></label>
        <button className="button primary" disabled={busy}>{busy ? "Đang tạo tài khoản…" : "Đăng ký"}</button>
      </form>
      {message && <p className="auth-error" role="alert">{message}</p>}
      <div className="auth-links"><Link href="/login">Đã có tài khoản? Đăng nhập</Link></div>
    </Shell>
  );
}

export function ForgotForm() {
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
    return (
      <Shell title="Kiểm tra hộp thư của bạn">
        <p className="auth-sub">Nếu tài khoản tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu. Liên kết hết hạn sau một giờ.</p>
        {done.devLink && <p className="auth-dev">Liên kết (dev): <a href={done.devLink}>{done.devLink}</a></p>}
        <div className="auth-links"><Link href="/login">← Về đăng nhập</Link></div>
      </Shell>
    );
  }

  return (
    <Shell title="Đặt lại mật khẩu">
      <p className="auth-sub">Nhập email đã đăng ký để nhận liên kết tạo mật khẩu mới.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" /></label>
        <button className="button primary" disabled={busy}>{busy ? "Đang gửi…" : "Gửi liên kết đặt lại"}</button>
      </form>
      {message && <p className="auth-error" role="alert">{message}</p>}
      <div className="auth-links"><Link href="/login">← Về đăng nhập</Link></div>
    </Shell>
  );
}

export function ResetForm() {
  const auth = useAuth();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
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
    return (
      <Shell title="Đã đổi mật khẩu">
        <p className="auth-sub">Mật khẩu của bạn đã được cập nhật. Mọi phiên cũ đã bị đăng xuất.</p>
        <div className="auth-links"><Link href="/login">Đăng nhập với mật khẩu mới</Link></div>
      </Shell>
    );
  }

  return (
    <Shell title="Tạo mật khẩu mới">
      {!token && <p className="auth-error" role="alert">Liên kết thiếu mã hợp lệ. Hãy yêu cầu liên kết mới.</p>}
      <form className="auth-form" onSubmit={submit}>
        <label>Mật khẩu mới<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={8} /></label>
        <label>Nhập lại mật khẩu<input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" minLength={8} /></label>
        <button className="button primary" disabled={busy || !token}>{busy ? "Đang cập nhật…" : "Đặt lại mật khẩu"}</button>
      </form>
      {message && <p className="auth-error" role="alert">{message}</p>}
      <div className="auth-links"><Link href="/forgot-password">Yêu cầu liên kết mới</Link></div>
    </Shell>
  );
}

export function VerifyEmailView() {
  const auth = useAuth();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) { setState("error"); setMessage("Liên kết thiếu mã hợp lệ."); return; }
    auth.verifyEmail(token).then(() => setState("ok")).catch((error) => { setState("error"); setMessage(errorMessage(error)); });
  }, [auth, token]);

  return (
    <Shell title={state === "ok" ? "Email đã xác thực" : state === "error" ? "Không xác thực được" : "Đang xác thực…"}>
      {state === "pending" && <p className="auth-sub">Vui lòng đợi trong giây lát…</p>}
      {state === "ok" && <><p className="auth-sub">Email của bạn đã được xác thực. Bạn có thể đăng nhập ngay.</p><div className="auth-links"><Link href="/login">Đăng nhập</Link></div></>}
      {state === "error" && <><p className="auth-error" role="alert">{message}</p><div className="auth-links"><Link href="/login">← Về đăng nhập</Link></div></>}
    </Shell>
  );
}
