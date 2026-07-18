import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailView } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Xác thực email", robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailView /></Suspense>;
}
