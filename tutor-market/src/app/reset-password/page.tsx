import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Đặt lại mật khẩu", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
