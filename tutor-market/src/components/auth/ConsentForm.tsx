"use client";

import type { ActiveLegalDocumentsResponse } from "@kimthanh-tutor/contracts";
import { useRouter } from "next/navigation";
import { type UIEvent, useEffect, useState } from "react";
import { authApi } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthProvider";

export function ConsentForm() {
  const auth = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<ActiveLegalDocumentsResponse | null>(null);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Chưa đăng nhập → về login; đã active → vào khu vực phụ huynh.
  useEffect(() => {
    if (!auth.loading && !auth.me) router.replace("/login");
    if (auth.me && auth.me.user.status === "active") router.replace("/account");
  }, [auth.loading, auth.me, router]);

  useEffect(() => {
    authApi.activeLegalDocuments().then(setDocs).catch(() => setMessage("Không tải được điều khoản. Thử lại sau."));
  }, []);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReachedBottom(true);
  }

  async function accept() {
    if (!docs?.terms || !docs?.privacy || !reachedBottom) return;
    setBusy(true);
    setMessage(null);
    try {
      const me = await auth.recordConsent({
        terms_document_id: docs.terms.id,
        privacy_document_id: docs.privacy.id,
        scroll_reached_bottom: true,
        consent_method: "scroll_and_click",
      });
      router.replace(me && me.user.status === "active" ? "/account" : "/login");
    } catch (error) {
      setMessage(error instanceof ApiClientError || error instanceof Error ? error.message : "Không ghi nhận được đồng ý.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card consent-card">
        <p className="auth-brand">Kim Thành Tutor</p>
        <h1>Điều khoản &amp; Quyền riêng tư</h1>
        <p className="auth-sub">Vui lòng đọc hết nội dung dưới đây rồi xác nhận đồng ý để tiếp tục.</p>
        <div className="consent-scroll" onScroll={onScroll}>
          {docs?.terms && docs?.privacy ? (
            <>
              <h2>{docs.terms.title}</h2>
              <p>Phiên bản {docs.terms.version}. Nội dung đầy đủ tại: {docs.terms.content_url}</p>
              <h2>{docs.privacy.title}</h2>
              <p>Phiên bản {docs.privacy.version}. Nội dung đầy đủ tại: {docs.privacy.content_url}</p>
              <p>Bằng việc tiếp tục, bạn xác nhận đã đọc và đồng ý với Điều khoản sử dụng và Chính sách bảo mật của Kim Thành Tutor.</p>
              <p className="consent-end">— Hết —</p>
            </>
          ) : (
            <p>Đang tải điều khoản…</p>
          )}
        </div>
        <button className="button primary" disabled={!reachedBottom || busy} onClick={() => void accept()}>
          {busy ? "Đang xác nhận…" : reachedBottom ? "Tôi đồng ý và tiếp tục" : "Cuộn hết để đồng ý"}
        </button>
        {message && <p className="auth-error" role="alert">{message}</p>}
      </div>
    </section>
  );
}
