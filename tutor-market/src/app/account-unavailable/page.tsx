import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Tài khoản không khả dụng", robots: { index: false, follow: false } };

export default function AccountUnavailablePage() {
  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">Kim Thành Tutor</p>
        <h1>Tài khoản không khả dụng</h1>
        <p className="auth-sub">Tài khoản của bạn đang bị tạm khóa hoặc đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ nếu cần trợ giúp.</p>
        <div className="auth-links"><Link href="/">← Về trang chủ</Link></div>
      </div>
    </section>
  );
}
