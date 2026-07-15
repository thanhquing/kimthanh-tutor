import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page">
      <div className="state">
        <p className="not-found-code" aria-hidden="true">404</p>
        <h1>Không tìm thấy trang</h1>
        <p>Đường dẫn không tồn tại hoặc đã được di chuyển.</p>
        <Link className="button" href="/">Về trang tìm gia sư</Link>
      </div>
    </section>
  );
}
