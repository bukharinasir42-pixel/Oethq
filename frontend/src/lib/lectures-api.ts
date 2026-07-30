import { apiFetch } from "./api";
import type { SkillKey } from "@/hooks/use-ownership";

export type CourseLecture = {
  id: string;
  skill: SkillKey;
  title: string;
  description: string | null;
  durationMin: number | null;
  displayOrder: number;
  hasVideo: boolean;
  locked: boolean;
};

export type LectureLibrary = { ownedSkills: SkillKey[]; isFreeTrial?: boolean; lectures: CourseLecture[] };
export type LecturePlayback = { id: string; title: string; skill: SkillKey; embedUrl: string | null };

export type CourseTest = {
  id: string;
  title: string;
  description: string | null;
  totalQuestions: number;
  timerDuration: number | null;
  locked: boolean;
};
export type CourseTestList = { skill: SkillKey; locked: boolean; tests: CourseTest[] };

export type AdminLecture = {
  id: string;
  skill: SkillKey;
  title: string;
  description: string | null;
  displayOrder: number;
  bunnyVideoId: string | null;
  videoUrl: string | null;
  durationMin: number | null;
  isPublished: boolean;
};

export type LectureInput = {
  skill: SkillKey;
  title: string;
  description?: string | null;
  displayOrder?: number;
  bunnyVideoId?: string | null;
  videoUrl?: string | null;
  durationMin?: number | null;
  isPublished?: boolean;
};

export const lecturesApi = {
  list: () => apiFetch<LectureLibrary>("/course-lectures"),
  playback: (id: string) => apiFetch<LecturePlayback>(`/course-lectures/${id}/playback`),
  courseTests: (skill: "READING" | "LISTENING") =>
    apiFetch<CourseTestList>(`/course-tests?skill=${skill}`),
  // admin
  listAll: () => apiFetch<{ lectures: AdminLecture[] }>("/course-lectures/admin"),
  create: (data: LectureInput) => apiFetch<AdminLecture>("/course-lectures", { method: "POST", body: data }),
  update: (id: string, data: Partial<LectureInput>) =>
    apiFetch<AdminLecture>(`/course-lectures/${id}`, { method: "PATCH", body: data }),
  remove: (id: string) => apiFetch<{ ok: boolean }>(`/course-lectures/${id}`, { method: "DELETE" })
};
