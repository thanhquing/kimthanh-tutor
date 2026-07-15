import type { KeysetPage, TutorPublicDetail, TutorSearchCard, TutorSearchQuery } from "@kimthanh-tutor/contracts";

const tutors: TutorSearchCard[] = [
  { id: "dev-minh-anh", display_name: "Nguyễn Minh Anh", avatar_media_id: null, subjects: ["Toán", "Vật lý"], grade_levels: [9, 10, 11, 12], teaching_modes: ["online", "offline"], region: "Hà Nội", education_level: "Thạc sĩ", school_name: "Đại học Sư phạm Hà Nội", fee_min: 180_000, fee_max: 250_000, rating_avg: 0, rating_count: 0, bio_snippet: null },
  { id: "dev-thu-ha", display_name: "Trần Thu Hà", avatar_media_id: null, subjects: ["Tiếng Anh"], grade_levels: [3, 4, 5, 6], teaching_modes: ["online"], region: "TP.HCM", education_level: "Cử nhân", school_name: "Đại học Ngoại ngữ", fee_min: 160_000, fee_max: 220_000, rating_avg: 0, rating_count: 0, bio_snippet: null },
  { id: "dev-quoc-bao", display_name: "Lê Quốc Bảo", avatar_media_id: null, subjects: ["Hóa học", "Sinh học"], grade_levels: [10, 11, 12], teaching_modes: ["offline"], region: "Đà Nẵng", education_level: "Cử nhân", school_name: "Đại học Bách khoa", fee_min: 170_000, fee_max: 230_000, rating_avg: 0, rating_count: 0, bio_snippet: null },
  { id: "dev-ngoc-lan", display_name: "Phạm Ngọc Lan", avatar_media_id: null, subjects: ["Ngữ văn"], grade_levels: [6, 7, 8, 9], teaching_modes: ["online", "offline"], region: "Hải Phòng", education_level: "Thạc sĩ", school_name: "Đại học Giáo dục", fee_min: 150_000, fee_max: 200_000, rating_avg: 0, rating_count: 0, bio_snippet: null },
  { id: "dev-hoang-nam", display_name: "Võ Hoàng Nam", avatar_media_id: null, subjects: ["Toán", "Tin học"], grade_levels: [5, 6, 7, 8], teaching_modes: ["online"], region: "Cần Thơ", education_level: "Cử nhân", school_name: "Đại học Cần Thơ", fee_min: 140_000, fee_max: 190_000, rating_avg: 0, rating_count: 0, bio_snippet: null },
  { id: "dev-khanh-linh", display_name: "Đỗ Khánh Linh", avatar_media_id: null, subjects: ["Tiếng Anh", "Ngữ văn"], grade_levels: [1, 2, 3, 4, 5], teaching_modes: ["offline"], region: "Hà Nội", education_level: "Cử nhân", school_name: "Đại học Sư phạm Hà Nội", fee_min: 130_000, fee_max: 180_000, rating_avg: 0, rating_count: 0, bio_snippet: null },
];

export function devSearchTutors(query: TutorSearchQuery = {}): KeysetPage<TutorSearchCard> {
  return { items: tutors.slice(0, query.limit ?? 12), next_cursor: null };
}

export function devPublicTutor(id: string): TutorPublicDetail | null {
  const tutor = tutors.find((item) => item.id === id);
  if (!tutor) return null;
  return {
    ...tutor,
    gender: null,
    voice_accent: null,
    unlock_state: "locked",
    unlock_via: null,
    paywall: {
      message: "Đăng nhập để xem nội dung chi tiết và các lựa chọn mở khóa hồ sơ.",
      products: ["single_unlock", "parent_vip"],
    },
  };
}
