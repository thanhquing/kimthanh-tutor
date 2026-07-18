import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Không có quyền", robots: { index: false, follow: false } };

export default function ForbiddenPage() {
  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">Kim Thành Tutor</p>
        <h1>Không có quyền truy cập</h1>
        <p className="auth-sub">Khu vực này dành cho phụ huynh. Tài khoản của bạn không có quyền phù hợp.</p>
        <div className="auth-links"><Link href="/">← Về trang chủ</Link></div>
      </div>
    </section>
  );
}
