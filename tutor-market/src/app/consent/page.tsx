import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsentForm } from "@/components/auth/ConsentForm";

export const metadata: Metadata = { title: "Điều khoản & Quyền riêng tư", robots: { index: false, follow: false } };

export default function ConsentPage() {
  return <Suspense><ConsentForm /></Suspense>;
}
