import type {
  AbsorptionLevel,
  KeysetPage,
  LessonLogDetail,
  LessonLogInput,
  LessonLogUpdateInput,
} from "@kimthanh-tutor/contracts";

export interface LessonLogFormValues {
  lessonAt: string;
  subject: string;
  content: string;
  homework: string;
  absorptionLevel: AbsorptionLevel;
  tutorNote: string;
}

export const ABSORPTION_OPTIONS: Array<{ value: AbsorptionLevel; label: string }> = [
  { value: "good", label: "Tiếp thu tốt" },
  { value: "normal", label: "Tiếp thu bình thường" },
  { value: "needs_review", label: "Cần ôn lại" },
];

export function absorptionLabel(value: AbsorptionLevel): string {
  return ABSORPTION_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formFromLog(log: LessonLogDetail): LessonLogFormValues {
  return {
    lessonAt: toDatetimeLocal(log.lesson_at),
    subject: log.subject,
    content: log.content ?? "",
    homework: log.homework ?? "",
    absorptionLevel: log.absorption_level,
    tutorNote: log.tutor_note ?? "",
  };
}

export function emptyLessonLogForm(now = new Date()): LessonLogFormValues {
  return {
    lessonAt: toDatetimeLocal(now.toISOString()),
    subject: "",
    content: "",
    homework: "",
    absorptionLevel: "normal",
    tutorNote: "",
  };
}

export function validateLessonLog(values: LessonLogFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!fromDatetimeLocal(values.lessonAt)) errors.lessonAt = "Vui lòng chọn ngày giờ hợp lệ.";
  const subject = values.subject.trim();
  if (!subject) errors.subject = "Vui lòng nhập môn/chủ đề buổi học.";
  else if (subject.length > 80) errors.subject = "Môn/chủ đề tối đa 80 ký tự.";
  if (values.content.length > 4000) errors.content = "Nội dung tối đa 4.000 ký tự.";
  if (values.homework.length > 2000) errors.homework = "Bài tập tối đa 2.000 ký tự.";
  if (values.tutorNote.length > 2000) errors.tutorNote = "Nhận xét tối đa 2.000 ký tự.";
  return errors;
}

export function inputFromForm(values: LessonLogFormValues): LessonLogInput {
  const lessonAt = fromDatetimeLocal(values.lessonAt);
  return {
    ...(lessonAt ? { lesson_at: lessonAt } : {}),
    subject: values.subject.trim(),
    ...(values.content.trim() ? { content: values.content.trim() } : {}),
    ...(values.homework.trim() ? { homework: values.homework.trim() } : {}),
    absorption_level: values.absorptionLevel,
    ...(values.tutorNote.trim() ? { tutor_note: values.tutorNote.trim() } : {}),
  };
}

export function updateInputFromForm(values: LessonLogFormValues): LessonLogUpdateInput {
  const lessonAt = fromDatetimeLocal(values.lessonAt);
  return {
    ...(lessonAt ? { lesson_at: lessonAt } : {}),
    subject: values.subject.trim(),
    content: values.content.trim(),
    homework: values.homework.trim(),
    absorption_level: values.absorptionLevel,
    tutor_note: values.tutorNote.trim(),
  };
}

export function mergeLessonPages(pages: KeysetPage<LessonLogDetail>[] | undefined): LessonLogDetail[] {
  const seen = new Set<string>();
  return (pages ?? []).flatMap((page) => page.items).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).sort((left, right) => {
    const byLessonAt = right.lesson_at.localeCompare(left.lesson_at);
    return byLessonAt === 0 ? right.id.localeCompare(left.id) : byLessonAt;
  });
}
