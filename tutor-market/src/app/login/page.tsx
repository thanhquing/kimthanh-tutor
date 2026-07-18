import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
