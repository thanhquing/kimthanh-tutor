import type { LegalDocument } from "@kimthanh-tutor/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type UIEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { authApi } from "../lib/api/auth";
import { ApiClientError } from "../lib/api/errors";
import { loginPath, routeAfterAuth, safeNextPath } from "../lib/redirects";

function DocumentCard({ document }: { document: LegalDocument }) {
  return <article className="legal-document"><div><span className="document-type">{document.doc_type === "terms" ? "Điều khoản sử dụng" : "Chính sách bảo mật"}</span><h2>{document.title}</h2></div><dl><div><dt>Phiên bản</dt><dd>{document.version}</dd></div><div><dt>Checksum</dt><dd><code>{document.checksum}</code></dd></div></dl><a href={document.content_url} target="_blank" rel="noreferrer">Mở toàn văn trong tab mới ↗</a></article>;
}

export function ConsentPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [reachedBottom, setReachedBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const documents = useQuery({
    queryKey: ["legal-documents", "active"],
    queryFn: () => authApi.activeLegalDocuments(),
    retry: 1,
  });
  const documentKey = useMemo(() => `${documents.data?.terms?.id ?? ""}:${documents.data?.privacy?.id ?? ""}`, [documents.data]);

  useEffect(() => {
    setReachedBottom(false);
    setAccepted(false);
  }, [documentKey]);

  if (!auth.loading && !auth.me) return <Navigate to={loginPath(next)} replace />;
  if (auth.me && auth.me.user.status !== "pending_consent") return <Navigate to={routeAfterAuth(auth.me, next)} replace />;

  function trackScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 2) setReachedBottom(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const terms = documents.data?.terms;
    const privacy = documents.data?.privacy;
    if (!terms || !privacy || !reachedBottom || !accepted) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await authApi.recordConsent({
        terms_document_id: terms.id,
        privacy_document_id: privacy.id,
        scroll_reached_bottom: true,
        consent_method: "scroll_and_click",
      });
      const me = await auth.loadMe();
      if (me) navigate(routeAfterAuth(me, next), { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "VALIDATION_ERROR") {
        setMessage("Phiên bản tài liệu có thể vừa thay đổi. Hãy đọc lại bản đang hiệu lực rồi xác nhận lại.");
        await queryClient.invalidateQueries({ queryKey: ["legal-documents", "active"] });
        setReachedBottom(false);
        setAccepted(false);
      } else {
        setMessage(error instanceof Error ? error.message : "Không thể lưu đồng ý lúc này.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="consent-page"><section className="consent-card" aria-labelledby="consent-title">
    <header className="consent-header"><div className="auth-brand"><span className="brand-mark" aria-hidden="true">KT</span><div><strong>Kim Thành Tutor</strong><span>Bước pháp lý bắt buộc</span></div></div><p className="eyebrow">Không thể bỏ qua</p><h1 id="consent-title">Điều khoản và quyền riêng tư</h1><p>Cuộn hết phần tóm tắt, mở toàn văn khi cần và xác nhận cả hai tài liệu đang hiệu lực.</p></header>
    {documents.isLoading ? <div className="legal-loading" role="status"><span className="spinner" />Đang tải tài liệu pháp lý…</div> : documents.isError ? <div className="legal-error" role="alert"><p>Không tải được tài liệu pháp lý. Workspace vẫn được khóa an toàn.</p><button className="button secondary" type="button" onClick={() => void documents.refetch()}>Thử lại</button></div> : !documents.data?.terms || !documents.data.privacy ? <div className="legal-error" role="alert">Chưa có đủ Điều khoản và Chính sách bảo mật đang hiệu lực. Vui lòng liên hệ hỗ trợ.</div> : <form onSubmit={submit}>
      <div className="legal-scroll" tabIndex={0} onScroll={trackScroll} aria-label="Tóm tắt tài liệu pháp lý, cần cuộn đến cuối">
        <section><h2>Trước khi bắt đầu</h2><p>Bạn xác nhận thông tin hồ sơ gia sư là thông tin tự khai trung thực, chỉ sử dụng dữ liệu phụ huynh và học sinh cho mục đích dạy học đã thống nhất.</p><p>Kim Thành Tutor cung cấp công cụ kết nối và QR học phí; nền tảng không thu hộ và không xác nhận biến động số dư ngân hàng của gia sư.</p></section>
        <DocumentCard document={documents.data.terms} />
        <DocumentCard document={documents.data.privacy} />
        <section><h2>Quyền riêng tư và trách nhiệm</h2><ul><li>Không chia sẻ dữ liệu học sinh ra ngoài mục đích lớp học.</li><li>Không đưa số điện thoại, email hoặc liên kết ngoài vào nội dung công khai trái chính sách.</li><li>Các bản đồng ý được lưu theo phiên bản tài liệu để phục vụ truy vết pháp lý.</li></ul></section>
        <div className="scroll-finish" role="note"><strong>Bạn đã đến cuối phần cần đọc.</strong><span>Sau khi xác nhận, hệ thống sẽ lưu hai document ID cùng dấu mốc đã cuộn hết.</span></div>
      </div>
      <label className={`consent-check${reachedBottom ? " enabled" : ""}`}><input type="checkbox" checked={accepted} disabled={!reachedBottom || submitting} onChange={(event) => setAccepted(event.target.checked)} /><span>Tôi đã đọc và đồng ý với Điều khoản sử dụng cùng Chính sách bảo mật ở trên.</span></label>
      {!reachedBottom && <p className="scroll-hint">Cuộn đến cuối khung nội dung để mở xác nhận.</p>}
      {message && <p className="form-error" role="alert">{message}</p>}
      <button className="button primary block consent-submit" disabled={!reachedBottom || !accepted || submitting}>{submitting ? "Đang lưu đồng ý…" : "Đồng ý và tiếp tục"}</button>
    </form>}
  </section></main>;
}
