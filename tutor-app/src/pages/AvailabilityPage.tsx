import type { AvailabilityType, TutorAvailability } from "@kimthanh-tutor/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { availabilityApi } from "../lib/api/availability";
import { ApiClientError } from "../lib/api/errors";
import {
  AVAILABILITY_TYPES,
  availabilityTypeLabel,
  buildWeekGrid,
  dayLabel,
  findOverlaps,
  hasErrors,
  type SlotInput,
  type SlotInputErrors,
  sortSlots,
  summarize,
  validateSlotInput,
  WEEK_DAYS,
} from "../lib/availability/availability";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";

const QUERY_KEY = ["tutor-availabilities"] as const;
type ListData = { items: TutorAvailability[] };

const EMPTY_FORM: SlotInput = {
  day_of_week: 0,
  start_time: "19:00",
  end_time: "21:00",
  type: "available",
  note: "",
};

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError || error instanceof Error) return error.message;
  return fallback;
}

function TypeBadge({ type }: { type: AvailabilityType }) {
  return <span className={`avail-badge type-${type}`}>{availabilityTypeLabel(type)}</span>;
}

function WeekGridView({ slots }: { slots: TutorAvailability[] }) {
  const grid = useMemo(() => buildWeekGrid(slots), [slots]);
  return (
    <div className="avail-grid-scroll">
      <table className="avail-grid" aria-label="Bảng lịch theo tuần">
        <thead>
          <tr>
            <th scope="col" className="avail-grid-time-head">
              <span className="visually-hidden">Giờ</span>
            </th>
            {WEEK_DAYS.map((day) => (
              <th scope="col" key={day.value} title={day.long}>
                {day.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row[0].hour}>
              <th scope="row" className="avail-grid-time">
                {String(row[0].hour).padStart(2, "0")}:00
              </th>
              {row.map((cell) => {
                const label = cell.slot
                  ? `${dayLabel(cell.day).long} ${String(cell.hour).padStart(2, "0")}:00 — ${availabilityTypeLabel(cell.slot.type)}`
                  : undefined;
                return (
                  <td
                    key={`${cell.day}-${cell.hour}`}
                    className={cell.slot ? `avail-cell on type-${cell.slot.type}` : "avail-cell"}
                    title={label}
                    aria-label={label}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddSlotDialog({
  slots,
  submitting,
  onClose,
  onSubmit,
}: {
  slots: TutorAvailability[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: SlotInput) => void;
}) {
  const [form, setForm] = useState<SlotInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<SlotInputErrors>({});

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const overlaps = useMemo(
    () => findOverlaps(form, slots),
    [form, slots],
  );

  function patch<K extends keyof SlotInput>(key: K, value: SlotInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validateSlotInput(form);
    setErrors(validation);
    if (hasErrors(validation)) return;
    onSubmit({ ...form, note: form.note?.trim() ?? "" });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-slot-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="add-slot-title">Thêm khung giờ</h2>
          <button type="button" className="icon-remove" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        </div>
        <form className="modal-body form-stack" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label className="field">
              <span>Thứ</span>
              <select
                value={form.day_of_week}
                onChange={(event) => patch("day_of_week", Number(event.target.value))}
              >
                {WEEK_DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.long}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Loại lịch</span>
              <select
                value={form.type}
                onChange={(event) => patch("type", event.target.value as AvailabilityType)}
              >
                {AVAILABILITY_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Bắt đầu</span>
              <input
                type="time"
                value={form.start_time}
                onChange={(event) => patch("start_time", event.target.value)}
                aria-invalid={!!errors.start_time}
              />
              {errors.start_time && <em className="field-error">{errors.start_time}</em>}
            </label>
            <label className="field">
              <span>Kết thúc</span>
              <input
                type="time"
                value={form.end_time}
                onChange={(event) => patch("end_time", event.target.value)}
                aria-invalid={!!errors.end_time}
              />
              {errors.end_time && <em className="field-error">{errors.end_time}</em>}
            </label>
          </div>
          <label className="field">
            <span>Ghi chú (tùy chọn)</span>
            <input
              value={form.note}
              maxLength={200}
              placeholder="Vd: Chỉ nhận online, chỉ Quận 1–3…"
              onChange={(event) => patch("note", event.target.value)}
              aria-invalid={!!errors.note}
            />
            {errors.note && <em className="field-error">{errors.note}</em>}
          </label>

          {overlaps.length > 0 && (
            <p className="avail-warn" role="status">
              Khung giờ này trùng {overlaps.length} khung đã có trên {dayLabel(form.day_of_week).long}. Bạn vẫn có
              thể lưu, nhưng nên kiểm tra lại.
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={submitting}>
              Hủy
            </button>
            <button type="submit" className="button primary" disabled={submitting}>
              {submitting ? "Đang lưu…" : "Lưu khung giờ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AvailabilityPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);

  const listQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => availabilityApi.list(),
  });

  const slots = useMemo(() => sortSlots(listQuery.data?.items ?? []), [listQuery.data]);
  const summary = useMemo(() => summarize(slots), [slots]);

  const createMutation = useMutation({
    mutationFn: (input: SlotInput) =>
      availabilityApi.create({
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time,
        type: input.type,
        note: input.note ? input.note : undefined,
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ListData>(QUERY_KEY);
      const optimistic: TutorAvailability = {
        id: `temp-${Date.now()}`,
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time,
        type: input.type,
        note: input.note ? input.note : null,
      };
      queryClient.setQueryData<ListData>(QUERY_KEY, (current) => ({
        items: [...(current?.items ?? []), optimistic],
      }));
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
      setBanner({ tone: "danger", text: errorText(error, "Không thêm được khung giờ.") });
    },
    onSuccess: () => {
      setDialogOpen(false);
      setBanner({ tone: "ok", text: "Đã thêm khung giờ." });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => availabilityApi.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ListData>(QUERY_KEY);
      queryClient.setQueryData<ListData>(QUERY_KEY, (current) => ({
        items: (current?.items ?? []).filter((slot) => slot.id !== id),
      }));
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
      setBanner({ tone: "danger", text: errorText(error, "Không xóa được khung giờ.") });
    },
    onSuccess: () => {
      setBanner({ tone: "ok", text: "Đã xóa khung giờ." });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Không gian gia sư</p>
          <h1>Lịch rảnh trong tuần</h1>
          <p>Cho phụ huynh biết bạn rảnh hoặc bận khi nào để chủ động chọn lịch học.</p>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => {
            setBanner(null);
            setDialogOpen(true);
          }}
          disabled={listQuery.isLoading}
        >
          + Thêm khung giờ
        </button>
      </header>

      {banner && (
        <p className={`profile-banner tone-${banner.tone}`} role={banner.tone === "danger" ? "alert" : "status"}>
          {banner.text}
        </p>
      )}

      {listQuery.isLoading ? (
        <div className="panel">
          <LoadingState label="Đang tải lịch rảnh…" />
        </div>
      ) : listQuery.isError ? (
        <div className="panel">
          <ErrorState
            title="Không tải được lịch"
            message="Lịch rảnh tạm thời không tải được."
            actionLabel="Thử lại"
            onAction={() => void listQuery.refetch()}
          />
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="panel-head">
              <h2>Bảng tuần</h2>
              <span className="panel-sub">
                {summary.slotCount} khung · {summary.availableHours} giờ rảnh · {summary.busyHours} giờ bận
              </span>
            </div>
            <WeekGridView slots={slots} />
            <div className="avail-legend">
              {AVAILABILITY_TYPES.map((type) => (
                <span key={type.value} className="avail-legend-item">
                  <span className={`avail-swatch type-${type.value}`} aria-hidden="true" /> {type.label}
                </span>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Danh sách khung giờ</h2>
            </div>
            {slots.length === 0 ? (
              <EmptyState
                title="Chưa có khung giờ"
                message="Thêm ít nhất vài khung giờ rảnh để phụ huynh dễ chọn lịch học thử."
              />
            ) : (
              <ul className="avail-list">
                {slots.map((slot) => {
                  const removing = deleteMutation.isPending && deleteMutation.variables === slot.id;
                  const optimistic = slot.id.startsWith("temp-");
                  return (
                    <li key={slot.id} className={`avail-row${optimistic ? " is-optimistic" : ""}`}>
                      <div className="avail-row-lead">
                        <strong>
                          {dayLabel(slot.day_of_week).long} · {slot.start_time}–{slot.end_time}
                        </strong>
                        <TypeBadge type={slot.type} />
                        {slot.note && <span className="avail-note">{slot.note}</span>}
                      </div>
                      <button
                        type="button"
                        className="button danger small"
                        disabled={optimistic || removing}
                        onClick={() => {
                          setBanner(null);
                          deleteMutation.mutate(slot.id);
                        }}
                      >
                        {removing ? "Đang xóa…" : "Xóa"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {dialogOpen && (
        <AddSlotDialog
          slots={slots}
          submitting={createMutation.isPending}
          onClose={() => setDialogOpen(false)}
          onSubmit={(input) => createMutation.mutate(input)}
        />
      )}
    </>
  );
}
