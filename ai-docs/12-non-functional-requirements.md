# Yêu Cầu Phi Chức Năng: Hiệu Năng Và Chịu Tải

Tài liệu này định lượng "chịu tải lớn ngay từ đầu" thành mục tiêu đo được và cách đạt được theo chiến lược PA2 (`15-architecture-and-tech-stack.md`): thiết kế đúng ngay, bật hạ tầng theo ngưỡng.

## 1. Mục tiêu hiệu năng (SLO)

| Đường (path) | Mục tiêu p95 | Ghi chú |
| --- | --- | --- |
| Tìm kiếm chợ gia sư | < 200ms | Hot-path công khai, chịu tải cao nhất |
| Chi tiết hồ sơ gia sư | < 250ms | Có kiểm tra quyền unlock |
| API đọc dashboard | < 300ms | Keyset pagination trên lesson_logs |
| Xử lý webhook thanh toán | < 500ms nhận + ack; xử lý side-effect async | Ack nhanh, side-effect qua outbox |
| Gửi thông báo | không nằm trong request | 100% async qua outbox/worker |
| Uptime API | 99.5% giai đoạn 1 | Health check + auto-restart |

Các mục tiêu về khả năng chịu tải: hệ thống phải phục vụ **toàn quốc** — thiết kế không được có nút thắt kiến trúc (single-writer bắt buộc, full-table scan trên hot-path, side-effect đồng bộ). Dung lượng cụ thể mở rộng bằng cách thêm máy (mục 7), không viết lại.

## 2. Hot-path #1: Tìm kiếm chợ gia sư

Đây là đường chịu tải lớn nhất và là nơi bản thiết kế cũ dễ sập. Nguyên tắc:

- **Không lọc trên chuỗi CSV.** Dùng bảng chuẩn hóa (`tutor_subjects`, `tutor_grade_levels`, `tutor_teaching_modes`, `tutor_offline_areas`) đã lập index → mỗi bộ lọc là index scan, không full-table scan.
- **Không tính điểm đánh giá runtime.** Đọc cột denormalized `rating_avg`, `rating_count` trên `tutor_profiles`. Cập nhật khi review đổi trạng thái (mục 5).
- **Chỉ quét hồ sơ published.** Partial index `WHERE status='published' AND deleted_at IS NULL`.
- **Keyset pagination** (mục 4), không OFFSET.
- **Trả tối thiểu cho thẻ xem thử**: chỉ cột cần cho card, không SELECT *; không kèm video/review.
- **Cache** kết quả bộ lọc phổ biến (mục 3).
- **Ngưỡng bật search engine**: khi > ~50k hồ sơ published hoặc p95 > 200ms → đồng bộ sang Meilisearch/OpenSearch qua `outbox_events`; API đọc qua `SearchPort` nên chỉ đổi adapter, không đổi nghiệp vụ.

### Kiến trúc trừu tượng hóa search

```
SearchController -> SearchPort (interface)
                      ├─ PgSearchAdapter    (mặc định: Prisma + bảng chuẩn hóa đã index + ILIKE school_name)
                      └─ MeiliSearchAdapter (bật khi chạm ngưỡng)
```

Nhờ `SearchPort`, việc nâng cấp là thay adapter + bật job đồng bộ, không đụng controller/nghiệp vụ.

## 3. Chiến lược cache (Redis)

Đây là kiến trúc mục tiêu theo ngưỡng. Tại snapshot 2026-07-16, Redis/BullMQ chưa là dependency runtime: search đọc trực tiếp PostgreSQL và rate limit dùng `@nestjs/throttler` in-memory. Trước khi chạy nhiều API instance phải bật shared/distributed rate limit; không được hiểu bảng TTL dưới đây là cache đã vận hành.

| Dữ liệu | TTL | Vô hiệu hóa khi |
| --- | --- | --- |
| Kết quả search theo tổ hợp filter phổ biến | 30–60s | Chấp nhận trễ nhẹ; hoặc bump version key khi hồ sơ đổi |
| Chi tiết công khai hồ sơ gia sư (bản xem thử) | 5 phút | Khi hồ sơ/kiểm duyệt đổi → xóa key theo `tutor_profile_id` |
| Danh mục tĩnh (môn, khối, tỉnh/huyện) | 1 giờ+ | Khi admin đổi danh mục |
| Trạng thái quyền unlock của user | ngắn (30s) hoặc không cache | Ưu tiên đúng hơn nhanh; kiểm tra DB cho hành động nhạy cảm |

Nguyên tắc: **không cache dữ liệu quyết định quyền truy cập/tiền** quá lâu. Cache là để giảm tải đọc công khai, không thay kiểm tra phân quyền.

## 4. Phân trang: keyset (seek) thay vì offset

- **Không dùng `OFFSET n`** cho danh sách lớn: offset càng lớn DB càng quét nhiều → chậm dần.
- Dùng **keyset**: sắp theo khóa ổn định (vd `(rating_avg DESC, id DESC)` cho search; `(lesson_at DESC, id DESC)` cho timeline) và truyền con trỏ `after` = giá trị khóa của item cuối.
- Trả `next_cursor` trong response; client gửi lại để lấy trang sau.

## 5. Denormalization & tính toán trước

- `tutor_profiles.rating_avg`, `rating_count`: cập nhật khi `reviews.status` chuyển sang/khỏi `published`. Chạy trong transaction cùng review, hoặc qua outbox nếu muốn tách tải.
- **Biểu đồ tăng trưởng**: tính từ `lesson_logs.absorption_level`. Với lớp có nhiều buổi, đọc theo keyset + tổng hợp ở tầng ứng dụng; nếu 1 lớp có rất nhiều buổi, cân nhắc bảng tổng hợp theo tuần/tháng. Giai đoạn 1 tính trực tiếp là đủ.
- Tránh N+1: nạp danh sách kèm dữ liệu liên quan bằng truy vấn gộp (`IN`/join), không lặp query trong vòng lặp.

## 6. Xử lý bất đồng bộ & tin cậy

- **Outbox pattern**: mọi side-effect (notification, đồng bộ search, gọi provider) ghi `outbox_events` trong cùng transaction nghiệp vụ. Worker (BullMQ) đọc và thực thi **at-least-once** → không mất sự kiện khi lỗi.
- **Idempotent consumer**: mỗi event có id; consumer chống xử lý trùng.
- **Retry + backoff + dead-letter**: job lỗi retry có backoff; quá số lần vào dead-letter để xử lý tay.
- **Webhook**: nhận → verify → ghi `webhook_events` → ack nhanh; cấp quyền/thông báo làm async qua outbox.

## 7. Mở rộng theo chiều ngang (khi tải tăng)

Nhắc lại bảng ngưỡng ở `15-...`. Vì thiết kế đã đúng, mỗi bước là "bật thêm", không viết lại:

1. **API stateless** → thêm instance sau load balancer. Không lưu state trong RAM tiến trình.
2. **Read-replica** → route query đọc-thuần (search, chi tiết công khai, dashboard) sang replica; ghi vẫn vào primary. Đây là target; code hiện chưa có read/write repository routing riêng.
3. **Search engine** → Meilisearch/OpenSearch qua adapter + outbox sync.
4. **Worker riêng** → tách service worker cho outbox/notification, scale độc lập API.
5. **Partition bảng lớn** → `lesson_logs`, `notifications`, `audit_logs`, `outbox_events` range theo tháng; kèm chính sách retention/archival.
6. **Connection pooling** → PgBouncer khi nhiều instance API để không cạn kết nối DB.

## 8. Kết nối DB & truy vấn

- Dùng connection pool; đặt `statement_timeout` hợp lý để query lỗi không giữ kết nối.
- Bọc thao tác nhiều-bảng trong transaction ngắn; tránh transaction dài giữ lock.
- Với hành động tiền/chuyển trạng thái: dùng optimistic locking (`version`) hoặc `SELECT ... FOR UPDATE` phạm vi hẹp.
- Bật `EXPLAIN ANALYZE` trong CI/benchmark cho các query hot-path để phát hiện seq scan ngoài ý muốn.

## 9. Quan sát (observability) — điều kiện để biết khi nào chạm ngưỡng

- **Metrics**: p50/p95/p99 cho search, chi tiết hồ sơ, webhook; QPS; tỉ lệ lỗi; độ trễ outbox; kích thước bảng lớn.
- **Tracing** request end-to-end với `request_id`.
- **Alerting** khi p95 search > 200ms, outbox backlog tăng, tỉ lệ webhook fail cao, DB CPU cao.
- Không có quan sát thì không biết khi nào bật hạ tầng → observability là bắt buộc từ đầu, dù nhẹ.

## 10. Kiểm thử tải (trước các mùa cao điểm)

- Load test hot-path search với dữ liệu thực tế (vài chục nghìn hồ sơ) trước mùa đầu năm học.
- Kiểm tra webhook chịu burst (provider gửi lại nhiều lần) — phải idempotent.
- Soak test worker outbox để chắc không rò rỉ bộ nhớ/không kẹt backlog.

## 11. Khoảng trống hạ tầng hiện tại

- `outbox_events` và emit trong transaction đã có, nhưng consumer/BullMQ drain outbox chưa được wire; vì vậy tiêu chí “100% async/no loss” chỉ đạt hoàn chỉnh sau task worker.
- Redis cache, distributed lock và distributed rate limit chưa bật; `@nestjs/throttler` in-memory chỉ phù hợp một API instance.
- Benchmark p95/EXPLAIN ANALYZE với dataset quy mô thật, metrics/tracing/alerting và load/soak test vẫn là backlog hạ tầng, không phải evidence hiện có.
