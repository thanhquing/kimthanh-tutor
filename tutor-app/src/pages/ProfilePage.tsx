import type {
  MediaAssetStatus,
  TutorProfileResponse,
  TutorProfileStatus,
} from "@kimthanh-tutor/contracts";
import { useQuery } from "@tanstack/react-query";
import { type ChangeEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../app/AuthContext";
import { tutorApi } from "../lib/api/tutors";
import { ApiClientError } from "../lib/api/errors";
import { formatVnd } from "../lib/format";
import { MEDIA_RULES, mediaStateLabel, type UploadKind, validateMediaFile } from "../lib/profile/media";
import {
  type Completeness,
  type CompletenessItem,
  emptyProfileForm,
  evaluateCompleteness,
  formToPayload,
  GENDER_OPTIONS,
  GRADE_OPTIONS,
  type OfflineAreaField,
  type ProfileFieldErrors,
  type ProfileFormState,
  profileToForm,
  SUBJECT_OPTIONS,
  TEACHING_MODE_OPTIONS,
  validateProfileForm,
} from "../lib/profile/profile-form";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";

const STATUS_META: Record<TutorProfileStatus, { label: string; tone: string }> = {
  draft: { label: "Bản nháp", tone: "mute" },
  publishable: { label: "Sẵn sàng đăng", tone: "warn" },
  published: { label: "Đã đăng công khai", tone: "ok" },
  hidden: { label: "Đang ẩn", tone: "warn" },
  suspended: { label: "Bị tạm khóa", tone: "danger" },
};

function StatusChip({ status }: { status: TutorProfileStatus }) {
  const meta = STATUS_META[status];
  return <span className={`profile-status tone-${meta.tone}`}>{meta.label}</span>;
}

function ChipRow({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="chip-field">
      <legend>{legend}</legend>
      <div className="chip-row">
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={`chip${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => onToggle(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function MediaStatusNote({ media }: { media: MediaAssetStatus }) {
  const state = mediaStateLabel(media.scan_status, media.moderation_status);
  return (
    <p className={`media-note tone-${state.tone}`} role="status">
      {state.text}
    </p>
  );
}

function MediaBlock({
  kind,
  title,
  mediaId,
  status,
  busy,
  error,
  onSelect,
  children,
}: {
  kind: UploadKind;
  title: string;
  mediaId: string | null;
  status: MediaAssetStatus | undefined;
  busy: boolean;
  error: string | null;
  onSelect: (file: File) => void;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rule = MEDIA_RULES[kind];
  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onSelect(file);
    event.target.value = "";
  }
  return (
    <div className="media-block">
      <div className="media-block-head">
        <strong>{title}</strong>
        <span className="media-hint">{rule.hint}</span>
      </div>
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={rule.accept}
        className="visually-hidden-input"
        aria-label={title}
        onChange={onChange}
        disabled={busy}
      />
      <button
        type="button"
        className="button secondary"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? "Đang tải lên…" : mediaId ? "Tải lại tệp khác" : "Tải tệp lên"}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <MediaStatusNote media={status} />}
    </div>
  );
}

function Checklist({ completeness }: { completeness: Completeness }) {
  return (
    <div className="checklist">
      <div className="checklist-head">
        <strong>{Math.round((completeness.done / completeness.total) * 100)}% hoàn thiện</strong>
        <span>
          {completeness.done}/{completeness.total}
        </span>
      </div>
      {completeness.items.map((item: CompletenessItem) => (
        <div key={item.key} className={`check${item.ok ? " on" : ""}`}>
          <span className="check-box" aria-hidden="true">{item.ok ? "✓" : ""}</span>
          {item.label}
        </div>
      ))}
    </div>
  );
}

function PreviewCard({ form }: { form: ProfileFormState }) {
  const subjectLabels = form.subjects
    .map((code) => SUBJECT_OPTIONS.find((option) => option.code === code)?.label ?? code)
    .join(", ");
  const feeMin = Number(form.expected_fee_min);
  const feeMax = Number(form.expected_fee_max);
  return (
    <div className="preview-card">
      <p className="preview-tag">Thông tin tự khai · chưa xác thực eKYC</p>
      <div className="preview-head">
        <span className="preview-avatar" aria-hidden="true">
          {(form.display_name || "GS").slice(0, 2).toUpperCase()}
        </span>
        <div>
          <strong>{form.display_name.trim() || "Chưa có tên hiển thị"}</strong>
          <span>{form.region.trim() || "Chưa có khu vực"}</span>
        </div>
      </div>
      <p className="preview-subjects">{subjectLabels || "Chưa chọn môn dạy"}</p>
      <p className="preview-fee">
        {Number.isFinite(feeMin) && form.expected_fee_min ? formatVnd(feeMin) : "—"} –{" "}
        {Number.isFinite(feeMax) && form.expected_fee_max ? formatVnd(feeMax) : "—"} / buổi
      </p>
      <p className="preview-bio">{form.bio.trim() ? form.bio.trim().slice(0, 160) : "Chưa có giới thiệu."}</p>
    </div>
  );
}

export function ProfilePage() {
  const auth = useAuth();
  const hasTutorProfile = auth.me?.profiles.tutor != null;

  const profileQuery = useQuery({
    queryKey: ["tutor-profile"],
    queryFn: () => tutorApi.getMyProfile(),
    enabled: hasTutorProfile,
    retry: 1,
  });

  const [form, setForm] = useState<ProfileFormState>(() => emptyProfileForm());
  const [status, setStatus] = useState<TutorProfileStatus>("draft");
  const [seededId, setSeededId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [banner, setBanner] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [publishMissing, setPublishMissing] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [avatarStatus, setAvatarStatus] = useState<MediaAssetStatus | undefined>();
  const [videoStatus, setVideoStatus] = useState<MediaAssetStatus | undefined>();
  const [uploadBusy, setUploadBusy] = useState<Record<UploadKind, boolean>>({ avatar: false, intro_video: false });
  const [uploadError, setUploadError] = useState<Record<UploadKind, string | null>>({ avatar: null, intro_video: null });

  const applyProfile = useCallback((profile: TutorProfileResponse) => {
    setForm(profileToForm(profile));
    setStatus(profile.status);
    setSeededId(profile.id);
  }, []);

  // Seed form một lần khi tải xong hồ sơ hiện có.
  useEffect(() => {
    if (profileQuery.data && profileQuery.data.id !== seededId) {
      applyProfile(profileQuery.data);
    }
  }, [profileQuery.data, seededId, applyProfile]);

  const refreshMediaStatus = useCallback(async (kind: UploadKind, mediaId: string | null) => {
    const setter = kind === "avatar" ? setAvatarStatus : setVideoStatus;
    if (!mediaId) {
      setter(undefined);
      return;
    }
    try {
      setter(await tutorApi.mediaStatus(mediaId));
    } catch {
      setter(undefined);
    }
  }, []);

  // Nạp trạng thái media khi hồ sơ có media id (sau seed).
  useEffect(() => {
    if (seededId) void refreshMediaStatus("avatar", form.avatar_media_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seededId, form.avatar_media_id]);
  useEffect(() => {
    if (seededId) void refreshMediaStatus("intro_video", form.intro_video_media_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seededId, form.intro_video_media_id]);

  const patch = useCallback(<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleInList = useCallback(
    <T extends string | number>(key: keyof ProfileFormState, value: T) => {
      setForm((prev) => {
        const list = prev[key] as T[];
        const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  function addOfflineArea() {
    setForm((prev) => ({ ...prev, offline_areas: [...prev.offline_areas, { province_code: "", district_code: "" }] }));
  }
  function updateOfflineArea(index: number, key: keyof OfflineAreaField, value: string) {
    setForm((prev) => ({
      ...prev,
      offline_areas: prev.offline_areas.map((area, i) => (i === index ? { ...area, [key]: value } : area)),
    }));
  }
  function removeOfflineArea(index: number) {
    setForm((prev) => ({ ...prev, offline_areas: prev.offline_areas.filter((_, i) => i !== index) }));
  }

  async function handleUpload(kind: UploadKind, file: File) {
    setUploadError((prev) => ({ ...prev, [kind]: null }));
    const invalid = validateMediaFile(kind, file);
    if (invalid) {
      setUploadError((prev) => ({ ...prev, [kind]: invalid }));
      return;
    }
    setUploadBusy((prev) => ({ ...prev, [kind]: true }));
    try {
      const upload = await tutorApi.createUploadUrl({ kind, content_type: file.type, size: file.size });
      await tutorApi.putToSignedUrl(upload.upload_url, file, file.type);
      patch(kind === "avatar" ? "avatar_media_id" : "intro_video_media_id", upload.media_id);
      await refreshMediaStatus(kind, upload.media_id);
      setBanner({ tone: "ok", text: "Đã tải tệp lên. Nhớ lưu hồ sơ để áp dụng." });
    } catch (error) {
      const text =
        error instanceof ApiClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Không tải được tệp lên. Thử lại sau.";
      setUploadError((prev) => ({ ...prev, [kind]: text }));
    } finally {
      setUploadBusy((prev) => ({ ...prev, [kind]: false }));
    }
  }

  function mapServerFieldErrors(error: ApiClientError) {
    const details = error.details;
    const next: ProfileFieldErrors = {};
    if (details && typeof details === "object") {
      const record = details as Record<string, unknown>;
      if ("field" in record && typeof record.field === "string") {
        next[record.field] = error.message;
      }
      if ("expected_fee_min" in record || "expected_fee_max" in record) {
        next.expected_fee_max = error.message;
      }
    }
    return next;
  }

  async function handleSave(): Promise<TutorProfileResponse | null> {
    const validation = validateProfileForm(form);
    setErrors(validation);
    setBanner(null);
    setPublishMissing([]);
    if (Object.keys(validation).length > 0) {
      setBanner({ tone: "danger", text: "Vui lòng sửa các trường được đánh dấu." });
      return null;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      const saved = hasTutorProfile
        ? await tutorApi.updateProfile(payload)
        : await tutorApi.createProfile(payload);
      applyProfile(saved);
      if (!hasTutorProfile) await auth.loadMe();
      setBanner({ tone: "ok", text: "Đã lưu hồ sơ." });
      return saved;
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "VALIDATION_ERROR") {
        setErrors(mapServerFieldErrors(error));
        setBanner({ tone: "danger", text: error.message });
      } else {
        setBanner({ tone: "danger", text: error instanceof Error ? error.message : "Không lưu được hồ sơ." });
      }
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    const saved = await handleSave();
    if (!saved) {
      setPublishing(false);
      return;
    }
    try {
      const result = await tutorApi.publish();
      setStatus(result.status);
      setPublishMissing([]);
      setBanner({ tone: "ok", text: "Hồ sơ đã đăng công khai." });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "VALIDATION_ERROR") {
        const details = error.details as { missing?: string[] } | undefined;
        setPublishMissing(details?.missing ?? []);
        setBanner({ tone: "danger", text: "Hồ sơ chưa đủ điều kiện đăng. Hoàn thiện các mục còn thiếu." });
      } else {
        setBanner({ tone: "danger", text: error instanceof Error ? error.message : "Không đăng được hồ sơ." });
      }
    } finally {
      setPublishing(false);
    }
  }

  const completeness = evaluateCompleteness(form);
  const busy = saving || publishing;
  const isLocked = status === "suspended";

  if (hasTutorProfile && profileQuery.isLoading) {
    return (
      <>
        <header className="page-heading"><div><p className="eyebrow">Không gian gia sư</p><h1>Hồ sơ gia sư</h1></div></header>
        <div className="panel"><LoadingState label="Đang tải hồ sơ gia sư…" /></div>
      </>
    );
  }
  if (hasTutorProfile && profileQuery.isError) {
    return (
      <>
        <header className="page-heading"><div><p className="eyebrow">Không gian gia sư</p><h1>Hồ sơ gia sư</h1></div></header>
        <div className="panel"><ErrorState title="Không tải được hồ sơ" message="Hồ sơ gia sư tạm thời không tải được." actionLabel="Thử lại" onAction={() => void profileQuery.refetch()} /></div>
      </>
    );
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Không gian gia sư</p>
          <h1>Hồ sơ gia sư</h1>
          <p>Hoàn thiện thông tin tự khai để phụ huynh tin tưởng và liên hệ.</p>
        </div>
        <StatusChip status={status} />
      </header>

      {banner && <p className={`profile-banner tone-${banner.tone}`} role={banner.tone === "danger" ? "alert" : "status"}>{banner.text}</p>}

      {isLocked && (
        <div className="panel"><EmptyState title="Hồ sơ đang bị tạm khóa" message="Hồ sơ đang bị quản trị viên tạm khóa. Bạn không thể chỉnh sửa hoặc đăng lại cho tới khi được mở." /></div>
      )}

      {!isLocked && (
        <div className="profile-grid">
          <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
            <section className="panel-section">
              <h2>Ảnh &amp; video giới thiệu</h2>
              <div className="media-row">
                <MediaBlock
                  kind="avatar"
                  title="Ảnh đại diện"
                  mediaId={form.avatar_media_id}
                  status={avatarStatus}
                  busy={uploadBusy.avatar}
                  error={uploadError.avatar}
                  onSelect={(file) => void handleUpload("avatar", file)}
                >
                  <div className="avatar-preview" aria-hidden="true">
                    {avatarStatus?.url ? <img src={avatarStatus.url} alt="" /> : (form.display_name || "GS").slice(0, 2).toUpperCase()}
                  </div>
                </MediaBlock>
                <MediaBlock
                  kind="intro_video"
                  title="Video giới thiệu"
                  mediaId={form.intro_video_media_id}
                  status={videoStatus}
                  busy={uploadBusy.intro_video}
                  error={uploadError.intro_video}
                  onSelect={(file) => void handleUpload("intro_video", file)}
                />
              </div>
            </section>

            <section className="panel-section">
              <h2>Danh tính</h2>
              <div className="field-grid">
                <label className="field">
                  <span>Tên hiển thị *</span>
                  <input value={form.display_name} maxLength={120} onChange={(e) => patch("display_name", e.target.value)} aria-invalid={!!errors.display_name} />
                  {errors.display_name && <em className="field-error">{errors.display_name}</em>}
                </label>
                <label className="field">
                  <span>Giới tính</span>
                  <select value={form.gender} onChange={(e) => patch("gender", e.target.value as ProfileFormState["gender"])}>
                    <option value="">Không nêu</option>
                    {GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Khu vực / Tỉnh thành</span>
                  <input value={form.region} maxLength={80} onChange={(e) => patch("region", e.target.value)} />
                </label>
                <label className="field">
                  <span>Chất giọng</span>
                  <input value={form.voice_accent} maxLength={80} onChange={(e) => patch("voice_accent", e.target.value)} placeholder="Vd: mien_bac" />
                </label>
              </div>
            </section>

            <section className="panel-section">
              <h2>Môn dạy, cấp lớp &amp; hình thức</h2>
              <ChipRow legend="Môn dạy" options={SUBJECT_OPTIONS.map((s) => ({ value: s.code, label: s.label }))} selected={form.subjects} onToggle={(value) => toggleInList("subjects", value)} />
              <ChipRow legend="Cấp lớp (1–12)" options={GRADE_OPTIONS.map((g) => ({ value: String(g), label: `Lớp ${g}` }))} selected={form.grade_levels.map(String)} onToggle={(value) => toggleInList("grade_levels", Number(value))} />
              <ChipRow legend="Hình thức dạy" options={TEACHING_MODE_OPTIONS.map((m) => ({ value: m.value, label: m.label }))} selected={form.teaching_modes} onToggle={(value) => toggleInList("teaching_modes", value)} />

              {form.teaching_modes.includes("offline") && (
                <div className="offline-areas">
                  <div className="offline-areas-head">
                    <span>Khu vực dạy offline *</span>
                    <button type="button" className="text-button" onClick={addOfflineArea}>+ Thêm khu vực</button>
                  </div>
                  {form.offline_areas.length === 0 && <p className="field-hint">Thêm ít nhất một tỉnh/thành để bật dạy offline.</p>}
                  {form.offline_areas.map((area, index) => (
                    <div className="offline-area-row" key={index}>
                      <input aria-label={`Mã tỉnh khu vực ${index + 1}`} placeholder="Mã tỉnh (vd HN)" value={area.province_code} onChange={(e) => updateOfflineArea(index, "province_code", e.target.value)} />
                      <input aria-label={`Mã quận khu vực ${index + 1}`} placeholder="Mã quận (tùy chọn)" value={area.district_code} onChange={(e) => updateOfflineArea(index, "district_code", e.target.value)} />
                      <button type="button" className="icon-remove" aria-label={`Xóa khu vực ${index + 1}`} onClick={() => removeOfflineArea(index)}>×</button>
                    </div>
                  ))}
                  {errors.offline_areas && <em className="field-error">{errors.offline_areas}</em>}
                </div>
              )}
            </section>

            <section className="panel-section">
              <h2>Học vấn</h2>
              <div className="field-grid">
                <label className="field">
                  <span>Trình độ</span>
                  <input value={form.education_level} maxLength={80} onChange={(e) => patch("education_level", e.target.value)} placeholder="Vd: university" />
                </label>
                <label className="field">
                  <span>Trường</span>
                  <input value={form.school_name} maxLength={160} onChange={(e) => patch("school_name", e.target.value)} />
                </label>
                <label className="field">
                  <span>Năm học (1–8)</span>
                  <input type="number" min={1} max={8} value={form.student_year} onChange={(e) => patch("student_year", e.target.value)} aria-invalid={!!errors.student_year} />
                  {errors.student_year && <em className="field-error">{errors.student_year}</em>}
                </label>
                <label className="field">
                  <span>Điểm thi (0–30)</span>
                  <input type="number" min={0} max={30} step="0.1" value={form.exam_score} onChange={(e) => patch("exam_score", e.target.value)} aria-invalid={!!errors.exam_score} />
                  {errors.exam_score && <em className="field-error">{errors.exam_score}</em>}
                </label>
                <label className="field">
                  <span>GPA (0–10)</span>
                  <input type="number" min={0} max={10} step="0.1" value={form.gpa} onChange={(e) => patch("gpa", e.target.value)} aria-invalid={!!errors.gpa} />
                  {errors.gpa && <em className="field-error">{errors.gpa}</em>}
                </label>
              </div>
            </section>

            <section className="panel-section">
              <h2>Học phí (đồng/buổi)</h2>
              <div className="field-grid">
                <label className="field">
                  <span>Tối thiểu</span>
                  <input type="number" min={0} value={form.expected_fee_min} onChange={(e) => patch("expected_fee_min", e.target.value)} aria-invalid={!!errors.expected_fee_min} />
                  {errors.expected_fee_min && <em className="field-error">{errors.expected_fee_min}</em>}
                </label>
                <label className="field">
                  <span>Tối đa</span>
                  <input type="number" min={0} value={form.expected_fee_max} onChange={(e) => patch("expected_fee_max", e.target.value)} aria-invalid={!!errors.expected_fee_max} />
                  {errors.expected_fee_max && <em className="field-error">{errors.expected_fee_max}</em>}
                </label>
              </div>
            </section>

            <section className="panel-section">
              <h2>Giới thiệu ngắn</h2>
              <label className="field">
                <span className="visually-hidden">Giới thiệu bản thân</span>
                <textarea value={form.bio} maxLength={4000} rows={5} onChange={(e) => patch("bio", e.target.value)} placeholder="Kinh nghiệm, phương pháp, thành tích học sinh…" />
              </label>
            </section>
          </form>

          <aside className="profile-aside">
            <section className="panel-section">
              <h2>Xem trước trên chợ gia sư</h2>
              <PreviewCard form={form} />
            </section>
            <section className="panel-section">
              <h2>Hoàn thiện hồ sơ</h2>
              <Checklist completeness={completeness} />
              {publishMissing.length > 0 && (
                <div className="publish-missing" role="alert">
                  <strong>Còn thiếu để đăng:</strong>
                  <ul>{publishMissing.map((key) => <li key={key}>{key}</li>)}</ul>
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      {!isLocked && (
        <div className="profile-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={() => void handleSave()}>
            {saving ? "Đang lưu…" : "Lưu nháp"}
          </button>
          <button type="button" className="button primary" disabled={busy} onClick={() => void handlePublish()}>
            {publishing ? "Đang đăng…" : "Đăng hồ sơ"}
          </button>
        </div>
      )}
    </>
  );
}
