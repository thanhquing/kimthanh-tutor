"use client";

import Link from "next/link";

// TODO(auth): Replace this guest-only stub with the session snapshot and route guard in TM-03.
export function PrivatePlaceholder({ title }: { title: string }) {
  return (
    <section className="page">
      <div className="state">
        <div className="state-mark" aria-hidden="true">KT</div>
        <h1>{title}</h1>
        <p>Bạn cần đăng nhập với vai trò phụ huynh để xem khu vực này.</p>
        <Link className="button" href="/login">Đăng nhập</Link>
      </div>
    </section>
  );
}
