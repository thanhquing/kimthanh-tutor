import Link from "next/link";
import type { TutorSearchCard } from "@kimthanh-tutor/contracts";
import { formatVnd } from "@/lib/format";

const teachingModeLabels = { online: "Trực tuyến", offline: "Tại nhà" } as const;

export function TutorCard({ tutor }: { tutor: TutorSearchCard }) {
  const fee = tutor.fee_min === null
    ? null
    : tutor.fee_max && tutor.fee_max !== tutor.fee_min
      ? `${formatVnd(tutor.fee_min)} – ${formatVnd(tutor.fee_max)}`
      : formatVnd(tutor.fee_min);
  const initials = tutor.display_name.split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
  const href = `/tutors/${encodeURIComponent(tutor.id)}`;

  return (
    <article className="tutor-card">
      <Link className="tutor-media" href={href} aria-label={`Xem hồ sơ ${tutor.display_name}`}>
        <span className="avatar-fallback" aria-hidden="true">{initials || "KT"}</span>
        <span className="tutor-badges"><span className="tutor-badge">Thông tin đã duyệt</span></span>
      </Link>
      <div className="tutor-body">
        <h3 className="tutor-name"><Link href={href}>{tutor.display_name}</Link></h3>
        <p className="tutor-meta">{[tutor.region, tutor.education_level, tutor.school_name].filter(Boolean).join(" · ") || "Gia sư Kim Thanh Tutor"}</p>
        <div className="tutor-tags">
          {tutor.subjects.slice(0, 3).map((subject) => <span className="tutor-tag" key={subject}>{subject}</span>)}
          {tutor.grade_levels.slice(0, 2).map((grade) => <span className="tutor-tag grade" key={grade}>Lớp {grade}</span>)}
          {tutor.teaching_modes.slice(0, 2).map((mode) => <span className="tutor-tag mode" key={mode}>{teachingModeLabels[mode]}</span>)}
        </div>
      </div>
      <div className="tutor-foot">
        <span className="tutor-fee"><em>Học phí / buổi</em><strong>{fee ?? "Trao đổi"}</strong></span>
        <Link className="btn btn-primary" href={href}>Xem hồ sơ</Link>
      </div>
    </article>
  );
}
