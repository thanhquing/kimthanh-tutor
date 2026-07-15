/* eslint-disable @next/next/no-page-custom-font -- App Router root layout loads these fonts for every route. */
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { ToastProvider } from "@/components/primitives";
import { absoluteUrl } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: { default: "Kim Thanh Tutor", template: "%s | Kim Thanh Tutor" },
  description: "Nền tảng tìm gia sư cho phụ huynh.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>
        <ToastProvider>
          <SiteHeader />
          <main className="site-main">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
