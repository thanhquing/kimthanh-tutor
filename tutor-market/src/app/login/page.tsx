import type { Metadata } from "next";
export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false, follow: false } };
export default function LoginPage() { return <section className="page state"><h1>Đăng nhập</h1><p>Đăng nhập bằng email và mật khẩu (Google/Facebook bổ sung khi có app client) được hoàn thiện ở TM-03.</p></section>; }
