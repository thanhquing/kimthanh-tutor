import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Quên mật khẩu", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <Suspense><ForgotForm /></Suspense>;
}
