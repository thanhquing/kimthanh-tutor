import type { AuthMeResponse, TutorProfileResponse } from "@kimthanh-tutor/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tutorApi } from "../lib/api/tutors";
import { ApiClientError } from "../lib/api/errors";
import { ProfilePage } from "./ProfilePage";

const loadMe = vi.fn();
let mockAuth: { me: AuthMeResponse | null; loadMe: typeof loadMe };

vi.mock("../app/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

const activeUser = { id: "user-1", phone: "0900000000", email: null, status: "active" as const };

function newTutor(): AuthMeResponse {
  return { user: activeUser, roles: [], profiles: { parent: null, tutor: null } };
}
function existingTutor(): AuthMeResponse {
  return { user: activeUser, roles: ["tutor"], profiles: { parent: null, tutor: { id: "tutor-1" } } };
}

function baseProfile(overrides: Partial<TutorProfileResponse> = {}): TutorProfileResponse {
  return {
    id: "tutor-1",
    display_name: "Cô Linh",
    bio: "Gia sư Toán",
    region: "Hà Nội",
    voice_accent: null,
    gender: "female",
    education_level: "university",
    school_name: "ĐHSP",
    student_year: 3,
    exam_score: 27,
    gpa: 3.4,
    fee_min: 180000,
    fee_max: 250000,
    avatar_media_id: null,
    intro_video_media_id: null,
    status: "draft",
    moderation_status: "pending",
    rating_avg: 0,
    rating_count: 0,
    version: 1,
    subjects: ["math"],
    grade_levels: [6],
    teaching_modes: ["online"],
    offline_areas: [],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    mockAuth = { me: newTutor(), loadMe };
    loadMe.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("creates a profile from the bootstrap draft and refreshes the session", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(tutorApi, "createProfile").mockResolvedValue(baseProfile());
    renderPage();

    await user.type(screen.getByLabelText(/Tên hiển thị/), "Cô Linh");
    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ display_name: "Cô Linh" });
    expect(loadMe).toHaveBeenCalled();
    expect(await screen.findByText("Đã lưu hồ sơ.")).toBeInTheDocument();
  });

  it("blocks save and shows field errors when the display name is empty", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(tutorApi, "createProfile");
    renderPage();

    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));

    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByText("Nhập tên hiển thị cho hồ sơ.")).toBeInTheDocument();
  });

  it("surfaces server publish requirements when the profile is incomplete", async () => {
    const user = userEvent.setup();
    vi.spyOn(tutorApi, "createProfile").mockResolvedValue(baseProfile({ bio: null }));
    vi.spyOn(tutorApi, "publish").mockRejectedValue(
      new ApiClientError("Hồ sơ chưa đủ điều kiện xuất bản", "api", 400, "VALIDATION_ERROR", {
        missing: ["bio", "subjects"],
      }),
    );
    renderPage();

    await user.type(screen.getByLabelText(/Tên hiển thị/), "Cô Linh");
    await user.click(screen.getByRole("button", { name: "Đăng hồ sơ" }));

    expect(await screen.findByText("Còn thiếu để đăng:")).toBeInTheDocument();
    expect(screen.getByText("bio")).toBeInTheDocument();
    expect(screen.getByText("subjects")).toBeInTheDocument();
  });

  it("publishes a complete profile and reflects the published status", async () => {
    const user = userEvent.setup();
    vi.spyOn(tutorApi, "createProfile").mockResolvedValue(baseProfile());
    vi.spyOn(tutorApi, "publish").mockResolvedValue({ status: "published" });
    renderPage();

    await user.type(screen.getByLabelText(/Tên hiển thị/), "Cô Linh");
    await user.click(screen.getByRole("button", { name: "Đăng hồ sơ" }));

    expect(await screen.findByText("Hồ sơ đã đăng công khai.")).toBeInTheDocument();
    expect(screen.getByText("Đã đăng công khai")).toBeInTheDocument();
  });

  it("uploads a valid avatar, PUTs to the signed URL and shows scan state", async () => {
    const user = userEvent.setup();
    const createUpload = vi.spyOn(tutorApi, "createUploadUrl").mockResolvedValue({
      media_id: "media-1",
      upload_url: "https://storage.example/avatar?sig=1",
      expires_at: "2026-07-17T00:10:00.000Z",
    });
    const put = vi.spyOn(tutorApi, "putToSignedUrl").mockResolvedValue();
    vi.spyOn(tutorApi, "mediaStatus").mockResolvedValue({
      media_id: "media-1",
      kind: "avatar",
      content_type: "image/png",
      moderation_status: "pending",
      scan_status: "pending",
      url: "https://storage.example/avatar?read=1",
      created_at: "2026-07-17T00:00:00.000Z",
    });
    renderPage();

    const file = new File(["binary"], "avatar.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Ảnh đại diện"), file);

    await waitFor(() => expect(createUpload).toHaveBeenCalled());
    expect(createUpload.mock.calls[0][0]).toMatchObject({ kind: "avatar", content_type: "image/png" });
    expect(put).toHaveBeenCalledWith("https://storage.example/avatar?sig=1", file, "image/png");
    expect(await screen.findByText("Đang quét an toàn tệp…")).toBeInTheDocument();
  });

  it("rejects an oversized avatar file before requesting an upload URL", async () => {
    const user = userEvent.setup();
    const createUpload = vi.spyOn(tutorApi, "createUploadUrl");
    renderPage();

    // MIME hợp lệ (qua thuộc tính accept) nhưng vượt 5MB → lớp validation của app chặn.
    const file = new File([new Uint8Array(6 * 1024 * 1024)], "avatar.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Ảnh đại diện"), file);

    expect(await screen.findByText(/Kích thước tệp vượt giới hạn/)).toBeInTheDocument();
    expect(createUpload).not.toHaveBeenCalled();
  });

  it("shows an error when the signed upload URL fails or is expired", async () => {
    const user = userEvent.setup();
    vi.spyOn(tutorApi, "createUploadUrl").mockResolvedValue({
      media_id: "media-1",
      upload_url: "https://storage.example/avatar?sig=expired",
      expires_at: "2026-07-17T00:10:00.000Z",
    });
    vi.spyOn(tutorApi, "putToSignedUrl").mockRejectedValue(new Error("Tải tệp lên thất bại (HTTP 403)."));
    renderPage();

    const file = new File(["binary"], "avatar.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Ảnh đại diện"), file);

    expect(await screen.findByText("Tải tệp lên thất bại (HTTP 403).")).toBeInTheDocument();
  });

  it("locks editing for a suspended profile", async () => {
    mockAuth = { me: existingTutor(), loadMe };
    vi.spyOn(tutorApi, "getMyProfile").mockResolvedValue(baseProfile({ status: "suspended" }));
    renderPage();

    expect(await screen.findByText("Hồ sơ đang bị tạm khóa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu nháp" })).not.toBeInTheDocument();
  });
});
