"use client";
export default function ErrorPage({ reset }: { error: Error; reset(): void }) { return <section className="page state"><h1>Không thể tải nội dung</h1><p>Vui lòng thử lại. Nếu lỗi tiếp diễn, hãy quay lại sau.</p><button className="button" onClick={reset}>Thử lại</button></section>; }
