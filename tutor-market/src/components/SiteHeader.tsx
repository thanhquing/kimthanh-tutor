"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "search" | "student" | "classes" | "trial" | "account" | "bell";

const navigation: Array<{ href: string; label: string; shortLabel: string; icon: IconName; private?: boolean }> = [
  { href: "/", label: "Tìm gia sư", shortLabel: "Tìm", icon: "search" },
  { href: "/students", label: "Học sinh", shortLabel: "Học sinh", icon: "student", private: true },
  { href: "/classes", label: "Lớp học", shortLabel: "Lớp", icon: "classes", private: true },
  { href: "/trials", label: "Học thử", shortLabel: "Học thử", icon: "trial", private: true },
  { href: "/account", label: "Tài khoản", shortLabel: "Tài khoản", icon: "account", private: true },
];

function ShellIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
  if (name === "student") return <svg {...common}><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 12.5V17c2.8 2 7.2 2 10 0v-4.5"/></svg>;
  if (name === "classes") return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  if (name === "trial") return <svg {...common}><path d="M20 7v5h-5"/><path d="M18.5 16a8 8 0 1 1 .7-7.5L20 12"/></svg>;
  if (name === "bell") return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/tutors/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <>
      <header className="app-header">
        <div className="container header-inner">
          <Link className="brand" href="/" aria-label="Kim Thanh Tutor — Tìm gia sư">
            <Image className="brand-mark" src="/assets/logo-mark.svg" alt="" width={38} height={38} priority />
            <span className="brand-text">
              <strong>Kim Thanh Tutor</strong>
              <em>Chợ gia sư uy tín cho phụ huynh Việt</em>
            </span>
          </Link>

          <nav className="header-nav" aria-label="Điều hướng chính">
            {navigation.slice(0, 4).map((item) => {
              const active = isActivePath(pathname, item.href);
              return <Link key={item.href} href={item.href} prefetch={item.private ? false : undefined} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>{item.label}</Link>;
            })}
          </nav>

          <div className="header-actions">
            <Link href="/notifications" prefetch={false} className="icon-btn" title="Thông báo" aria-label="Thông báo">
              <ShellIcon name="bell" />
            </Link>
            <Link className="btn btn-ghost login-link" href="/login">Đăng nhập</Link>
          </div>
        </div>
      </header>

      <nav className="bottom-nav" aria-label="Điều hướng di động">
        {navigation.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} prefetch={item.private ? false : undefined} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              <ShellIcon name={item.icon} size={22} />
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
