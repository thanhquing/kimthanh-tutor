import type { Metadata } from "next";
import { PrivateGuard } from "@/components/auth/PrivateGuard";
export const metadata: Metadata = { robots: { index: false, follow: false } };
/** Không SSR dữ liệu riêng tư: guard client sau auth + consent (TM-03). */
export default function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PrivateGuard>{children}</PrivateGuard>;
}
