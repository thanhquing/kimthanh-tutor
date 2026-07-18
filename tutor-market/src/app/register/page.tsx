import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Đăng ký", robots: { index: false, follow: false } };

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
