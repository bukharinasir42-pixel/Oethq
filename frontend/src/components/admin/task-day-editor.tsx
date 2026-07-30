"use client";

import { useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  FileText,
  ImageIcon,
  Save,
  Trash2,
  Video
} from "lucide-react";
import { InlineLoader, UploadProgressRing } from "@/components/loaders";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiUpload } from "@/lib/api";
import { formatTaskDayTitle } from "@/lib/task-day-utils";
import type { StorageAssetDto, TaskBuilderItem } from "@/lib/types";

export type EditableTask = TaskBuilderItem & {
  assignedReadingTestId?: string;
  assignedListeningTestId?: string;
  assignedPastPaperId?: string;
  assignedPastPaperTestId?: string;
};

type TaskDayEditorProps = {
  selectedTask: EditableTask;
  previousTask: EditableTask | null;
  nextTask: EditableTask | null;
  onSelectDay: (dayNumber: number) => void;
  dirtyDays: number[];
  isTaskConfigured: (task: EditableTask) => boolean;
  onUpdate: (dayNumber: number, patch: Partial<EditableTask>) => void;
  onSave: (task: EditableTask) => void | Promise<void>;
  saving: boolean;
  readingTestOptions: Array<{ label: string; value: string }>;
  listeningTestOptions: Array<{ label: string; value: string }>;
  emptyTestValue: string;
  token: string | null;
};

const ACCORDION_SECTIONS = ["content", "article", "assignments", "cheat-sheet"] as const;

function getAssetDisplayUrl(asset?: StorageAssetDto | null, fallbackUrl?: string | null) {
  // Prefer the signed URL: media buckets are private, so the unsigned publicUrl 403s.
  // Matches the portal viewer + test-builder, which already prefer signedUrl.
  return asset?.signedUrl || asset?.publicUrl || fallbackUrl?.trim() || "";
}

function CopyUrlField({
  id,
  label,
  url
}: {
  id: string;
  label: string;
  url: string;
}) {
  const copyUrl = async () => {
    if (!url) {
      toast.error("Upload a video first to generate a URL");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied");
    } catch {
      toast.error("Could not copy URL");
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={url}
          readOnly
          disabled
          className="font-mono text-sm"
          placeholder="Upload a video to generate the S3 URL"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => void copyUrl()}
          disabled={!url}
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function TaskDayEditor({
  selectedTask,
  previousTask,
  nextTask,
  onSelectDay,
  dirtyDays,
  isTaskConfigured,
  onUpdate,
  onSave,
  saving,
  readingTestOptions,
  listeningTestOptions,
  emptyTestValue,
  token
}: TaskDayEditorProps) {
  const lectureVideoInputRef = useRef<HTMLInputElement | null>(null);
  const lectureThumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const coreSkillVideoInputRef = useRef<HTMLInputElement | null>(null);
  const coreSkillThumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const cheatSheetInputRef = useRef<HTMLInputElement | null>(null);
  const articlePdfInputRef = useRef<HTMLInputElement | null>(null);
  const [lectureVideoUploadProgress, setLectureVideoUploadProgress] = useState<number | null>(null);
  const [lectureThumbnailUploadProgress, setLectureThumbnailUploadProgress] = useState<number | null>(null);
  const [coreSkillVideoUploadProgress, setCoreSkillVideoUploadProgress] = useState<number | null>(null);
  const [coreSkillThumbnailUploadProgress, setCoreSkillThumbnailUploadProgress] = useState<number | null>(null);
  const [cheatSheetUploadProgress, setCheatSheetUploadProgress] = useState<number | null>(null);
  const [articlePdfUploadProgress, setArticlePdfUploadProgress] = useState<number | null>(null);
  const lectureDisplayUrl = getAssetDisplayUrl(selectedTask.lectureAsset, selectedTask.lectureUrl);
  const lectureThumbnailDisplayUrl = getAssetDisplayUrl(selectedTask.lectureThumbnailAsset);
  const coreSkillDisplayUrl = getAssetDisplayUrl(selectedTask.articleAsset, selectedTask.articleUrl);
  const coreSkillThumbnailDisplayUrl = getAssetDisplayUrl(selectedTask.articleThumbnailAsset);
  const isDirty = dirtyDays.includes(selectedTask.dayNumber);
  const linkedCount = [selectedTask.assignedReadingTestId, selectedTask.assignedListeningTestId].filter(
    Boolean
  ).length;

  const uploadDayVideo = async (
    file: File | null,
    slot: "lecture-video" | "coreskill-video",
    inputRef: RefObject<HTMLInputElement | null>,
    setUploadProgress: (value: number | null) => void
  ) => {
    if (!file || !token) {
      if (!token) toast.error("Sign in again to upload");
      return;
    }
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("dayNumber", String(selectedTask.dayNumber));
      formData.append("slot", slot);
      const asset = await apiUpload<StorageAssetDto>(`/storage/upload/VIDEO`, formData, {
        token,
        onProgress: setUploadProgress
      });
      const displayUrl = getAssetDisplayUrl(asset);
      if (slot === "lecture-video") {
        onUpdate(selectedTask.dayNumber, {
          lectureAssetId: asset.id,
          lectureAsset: asset,
          lectureUrl: displayUrl
        });
        toast.success(asset.replaced ? "Lecture video replaced" : "Lecture video attached");
      } else {
        onUpdate(selectedTask.dayNumber, {
          articleAssetId: asset.id,
          articleAsset: asset,
          articleUrl: displayUrl
        });
        toast.success(asset.replaced ? "Core skills video replaced" : "Core skills video attached");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Video upload failed");
    } finally {
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clearLectureVideo = () => {
    onUpdate(selectedTask.dayNumber, { lectureAssetId: "", lectureAsset: null, lectureUrl: "" });
    toast.message("Lecture video cleared — save to persist");
  };

  const uploadLectureThumbnail = async (file: File | null) => {
    if (!file || !token) {
      if (!token) toast.error("Sign in again to upload");
      return;
    }
    setLectureThumbnailUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("dayNumber", String(selectedTask.dayNumber));
      formData.append("slot", "lecture-thumbnail");
      const asset = await apiUpload<StorageAssetDto>(`/storage/upload/IMAGE`, formData, {
        token,
        onProgress: setLectureThumbnailUploadProgress
      });
      onUpdate(selectedTask.dayNumber, {
        lectureThumbnailAssetId: asset.id,
        lectureThumbnailAsset: asset
      });
      toast.success(asset.replaced ? "Lecture thumbnail replaced" : "Lecture thumbnail attached");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Thumbnail upload failed");
    } finally {
      setLectureThumbnailUploadProgress(null);
      if (lectureThumbnailInputRef.current) lectureThumbnailInputRef.current.value = "";
    }
  };

  const clearLectureThumbnail = () => {
    onUpdate(selectedTask.dayNumber, { lectureThumbnailAssetId: "", lectureThumbnailAsset: null });
    toast.message("Lecture thumbnail cleared — save to persist");
  };

  const clearCoreSkillVideo = () => {
    onUpdate(selectedTask.dayNumber, { articleAssetId: "", articleAsset: null, articleUrl: "" });
    toast.message("Core skills video cleared — save to persist");
  };

  const uploadCoreSkillThumbnail = async (file: File | null) => {
    if (!file || !token) {
      if (!token) toast.error("Sign in again to upload");
      return;
    }
    setCoreSkillThumbnailUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("dayNumber", String(selectedTask.dayNumber));
      formData.append("slot", "coreskill-thumbnail");
      const asset = await apiUpload<StorageAssetDto>(`/storage/upload/IMAGE`, formData, {
        token,
        onProgress: setCoreSkillThumbnailUploadProgress
      });
      onUpdate(selectedTask.dayNumber, {
        articleThumbnailAssetId: asset.id,
        articleThumbnailAsset: asset
      });
      toast.success(asset.replaced ? "Core skills thumbnail replaced" : "Core skills thumbnail attached");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Thumbnail upload failed");
    } finally {
      setCoreSkillThumbnailUploadProgress(null);
      if (coreSkillThumbnailInputRef.current) coreSkillThumbnailInputRef.current.value = "";
    }
  };

  const clearCoreSkillThumbnail = () => {
    onUpdate(selectedTask.dayNumber, { articleThumbnailAssetId: "", articleThumbnailAsset: null });
    toast.message("Core skills thumbnail cleared — save to persist");
  };

  const uploadCheatSheet = async (file: File | null) => {
    if (!file || !token) {
      if (!token) toast.error("Sign in again to upload");
      return;
    }
    if (file.type && file.type !== "application/pdf") {
      toast.error("Cheat sheet must be a PDF file");
      return;
    }
    setCheatSheetUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("dayNumber", String(selectedTask.dayNumber));
      formData.append("slot", "cheat-sheet");
      const asset = await apiUpload<StorageAssetDto>(`/storage/upload/PDF`, formData, {
        token,
        onProgress: setCheatSheetUploadProgress
      });
      onUpdate(selectedTask.dayNumber, {
        cheatSheetAssetId: asset.id,
        cheatSheetAsset: asset
      });
      toast.success(asset.replaced ? "Cheat sheet replaced" : "Cheat sheet attached");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Cheat sheet upload failed");
    } finally {
      setCheatSheetUploadProgress(null);
      if (cheatSheetInputRef.current) cheatSheetInputRef.current.value = "";
    }
  };

  const clearCheatSheet = () => {
    onUpdate(selectedTask.dayNumber, { cheatSheetAssetId: "", cheatSheetAsset: null });
    toast.message("Cheat sheet cleared — save to persist");
  };

  const uploadArticlePdf = async (file: File | null) => {
    if (!file || !token) {
      if (!token) toast.error("Sign in again to upload");
      return;
    }
    if (file.type && file.type !== "application/pdf") {
      toast.error("Article must be a PDF file");
      return;
    }
    setArticlePdfUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("dayNumber", String(selectedTask.dayNumber));
      formData.append("slot", "article-pdf");
      const asset = await apiUpload<StorageAssetDto>(`/storage/upload/PDF`, formData, {
        token,
        onProgress: setArticlePdfUploadProgress
      });
      onUpdate(selectedTask.dayNumber, {
        articlePdfAssetId: asset.id,
        articlePdfAsset: asset,
        articleContent: ""
      });
      toast.success(asset.replaced ? "Article PDF replaced" : "Article PDF attached");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Article PDF upload failed");
    } finally {
      setArticlePdfUploadProgress(null);
      if (articlePdfInputRef.current) articlePdfInputRef.current.value = "";
    }
  };

  const clearArticlePdf = () => {
    onUpdate(selectedTask.dayNumber, { articlePdfAssetId: "", articlePdfAsset: null });
    toast.message("Article PDF cleared — save to persist");
  };

  return (
    <div
      id="task-editor-top"
      className="flex min-w-0 w-full flex-col overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]"
    >
      <header className="navy-panel relative shrink-0 overflow-hidden px-4 py-5 sm:px-6">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7CC4FF]">
                Editor
              </span>
              {isDirty ? (
                <Badge variant="secondary" className="border-transparent bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))] text-[10px] tracking-wide">
                  Unsaved
                </Badge>
              ) : (
                <Badge variant="outline" className="border-white/20 bg-white/10 text-[10px] tracking-wide text-[#B9CEE8]">
                  Saved
                </Badge>
              )}
            </div>
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {formatTaskDayTitle(selectedTask.dayNumber)}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#B9CEE8]">
                Configure copy, links, assessments, and whether this day is visible to learners. Expand the sections
                below; the admin page scrolls so you can reach every field.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedTask.isPublished ? "default" : "outline"}
                className={
                  selectedTask.isPublished
                    ? "border-transparent bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]"
                    : "border-white/20 bg-white/10 text-[#B9CEE8]"
                }
              >
                {selectedTask.isPublished ? "Published" : "Draft"}
              </Badge>
              <Badge variant="outline" className="border-white/20 bg-white/10 text-[#EAF2FC]">
                {isTaskConfigured(selectedTask) ? "Titles set" : "Needs titles"}
              </Badge>
              <Badge variant="outline" className="border-white/20 bg-white/10 tabular-nums text-[#EAF2FC]">
                {linkedCount} test{linkedCount === 1 ? "" : "s"} linked
              </Badge>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row lg:w-auto lg:flex-col xl:flex-row">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white sm:flex-none"
                disabled={!previousTask}
                onClick={() => previousTask && onSelectDay(previousTask.dayNumber)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Prev
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white sm:flex-none"
                disabled={!nextTask}
                onClick={() => nextTask && onSelectDay(nextTask.dayNumber)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-10 min-w-[9rem] shadow-sm sm:ml-auto lg:ml-0 xl:ml-auto"
              disabled={saving}
              onClick={() => void onSave(selectedTask)}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {saving ? <InlineLoader label="Saving day" size="sm" /> : <Save className="h-4 w-4" aria-hidden />}
                {!saving ? "Save day" : null}
              </span>
            </Button>
          </div>
        </div>

        <div className="relative mt-6 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-background/80 px-3 py-3 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lectures</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {isTaskConfigured(selectedTask) ? "Passes checklist" : "Add lecture and core skills titles"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-background/80 px-3 py-3 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assignments</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{linkedCount} linked</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-background/80 px-3 py-3 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {isDirty ? "Save before switching day" : "No pending edits"}
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 sm:px-6 sm:py-6">
        <Accordion type="multiple" defaultValue={[...ACCORDION_SECTIONS]} className="w-full space-y-2">
          <AccordionItem
            value="content"
            className="overflow-hidden rounded-[16px] border border-border border-b-0 bg-muted/40 px-4 data-[state=open]:shadow-[var(--shadow-card)]"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-3 text-left">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-display text-base font-semibold">Lectures</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Lecture and core skills links</span>
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 pt-0">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-border/50 bg-card/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Lecture</p>
                  <div className="space-y-2">
                    <Label htmlFor={`lecture-title-${selectedTask.dayNumber}`}>Title</Label>
                    <Input
                      id={`lecture-title-${selectedTask.dayNumber}`}
                      value={selectedTask.lectureTitle}
                      onChange={(e) => onUpdate(selectedTask.dayNumber, { lectureTitle: e.target.value })}
                    />
                  </div>
                  <CopyUrlField
                    id={`lecture-url-${selectedTask.dayNumber}`}
                    label="URL"
                    url={lectureDisplayUrl}
                  />
                  <div className="space-y-3 rounded-xl border border-dashed border-primary/25 bg-primary/[0.04] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <Video className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Lecture video file (optional)</p>
                        <p className="text-xs text-muted-foreground">
                          Candidates see this inline in the portal when uploaded. MP4 / WebM recommended.
                        </p>
                      </div>
                    </div>
                    <input
                      ref={lectureVideoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) =>
                        void uploadDayVideo(
                          e.target.files?.[0] ?? null,
                          "lecture-video",
                          lectureVideoInputRef,
                          setLectureVideoUploadProgress
                        )
                      }
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!token || lectureVideoUploadProgress != null}
                        onClick={() => lectureVideoInputRef.current?.click()}
                      >
                        {selectedTask.lectureAssetId || selectedTask.lectureAsset ? "Replace video" : "Upload video"}
                      </Button>
                      {lectureVideoUploadProgress != null ? (
                        <UploadProgressRing value={lectureVideoUploadProgress} label="Uploading video…" />
                      ) : null}
                      {(selectedTask.lectureAssetId || selectedTask.lectureAsset) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={clearLectureVideo}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Remove file
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <ImageIcon className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Lecture video thumbnail (optional)</p>
                        <p className="text-xs text-muted-foreground">
                          Shown before playback in the candidate portal. JPG, PNG, or WebP recommended.
                        </p>
                      </div>
                    </div>
                    {lectureThumbnailDisplayUrl ? (
                      <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={lectureThumbnailDisplayUrl}
                          alt="Lecture video thumbnail preview"
                          className="aspect-video w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <input
                      ref={lectureThumbnailInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/*"
                      className="hidden"
                      onChange={(e) => void uploadLectureThumbnail(e.target.files?.[0] ?? null)}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!token || lectureThumbnailUploadProgress != null}
                        onClick={() => lectureThumbnailInputRef.current?.click()}
                      >
                        {selectedTask.lectureThumbnailAssetId || selectedTask.lectureThumbnailAsset
                          ? "Replace thumbnail"
                          : "Upload thumbnail"}
                      </Button>
                      {lectureThumbnailUploadProgress != null ? (
                        <UploadProgressRing value={lectureThumbnailUploadProgress} label="Uploading thumbnail…" />
                      ) : null}
                      {selectedTask.lectureThumbnailAssetId || selectedTask.lectureThumbnailAsset ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={clearLectureThumbnail}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Remove thumbnail
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="space-y-4 rounded-2xl border border-border/50 bg-card/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Core Skills</p>
                  <div className="space-y-2">
                    <Label htmlFor={`article-title-${selectedTask.dayNumber}`}>Title</Label>
                    <Input
                      id={`article-title-${selectedTask.dayNumber}`}
                      value={selectedTask.articleTitle}
                      onChange={(e) => onUpdate(selectedTask.dayNumber, { articleTitle: e.target.value })}
                    />
                  </div>
                  <CopyUrlField
                    id={`article-url-${selectedTask.dayNumber}`}
                    label="URL"
                    url={coreSkillDisplayUrl}
                  />
                  <div className="space-y-3 rounded-xl border border-dashed border-primary/25 bg-primary/[0.04] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <Video className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Core skills video file (optional)</p>
                        <p className="text-xs text-muted-foreground">
                          Candidates see this inline in the portal when uploaded. MP4 / WebM recommended.
                        </p>
                      </div>
                    </div>
                    <input
                      ref={coreSkillVideoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) =>
                        void uploadDayVideo(
                          e.target.files?.[0] ?? null,
                          "coreskill-video",
                          coreSkillVideoInputRef,
                          setCoreSkillVideoUploadProgress
                        )
                      }
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!token || coreSkillVideoUploadProgress != null}
                        onClick={() => coreSkillVideoInputRef.current?.click()}
                      >
                        {selectedTask.articleAssetId || selectedTask.articleAsset ? "Replace video" : "Upload video"}
                      </Button>
                      {coreSkillVideoUploadProgress != null ? (
                        <UploadProgressRing value={coreSkillVideoUploadProgress} label="Uploading video…" />
                      ) : null}
                      {(selectedTask.articleAssetId || selectedTask.articleAsset) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={clearCoreSkillVideo}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Remove file
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <ImageIcon className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Core skills video thumbnail (optional)</p>
                        <p className="text-xs text-muted-foreground">
                          Shown before playback in the candidate portal. JPG, PNG, or WebP recommended.
                        </p>
                      </div>
                    </div>
                    {coreSkillThumbnailDisplayUrl ? (
                      <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={coreSkillThumbnailDisplayUrl}
                          alt="Core skills video thumbnail preview"
                          className="aspect-video w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <input
                      ref={coreSkillThumbnailInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/*"
                      className="hidden"
                      onChange={(e) => void uploadCoreSkillThumbnail(e.target.files?.[0] ?? null)}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!token || coreSkillThumbnailUploadProgress != null}
                        onClick={() => coreSkillThumbnailInputRef.current?.click()}
                      >
                        {selectedTask.articleThumbnailAssetId || selectedTask.articleThumbnailAsset
                          ? "Replace thumbnail"
                          : "Upload thumbnail"}
                      </Button>
                      {coreSkillThumbnailUploadProgress != null ? (
                        <UploadProgressRing value={coreSkillThumbnailUploadProgress} label="Uploading thumbnail…" />
                      ) : null}
                      {selectedTask.articleThumbnailAssetId || selectedTask.articleThumbnailAsset ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={clearCoreSkillThumbnail}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Remove thumbnail
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="article"
            className="overflow-hidden rounded-[16px] border border-border border-b-0 bg-muted/40 px-4 data-[state=open]:shadow-[var(--shadow-card)]"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-3 text-left">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-display text-base font-semibold">Article</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Title, description, and PDF for today&apos;s reading passage
                  </span>
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 pt-0">
              <div className="space-y-4 rounded-2xl border border-border/50 bg-card/70 p-4">
                <div className="space-y-2">
                  <Label htmlFor={`article-passage-title-${selectedTask.dayNumber}`}>Title</Label>
                  <Input
                    id={`article-passage-title-${selectedTask.dayNumber}`}
                    value={selectedTask.articleTitle}
                    onChange={(e) => onUpdate(selectedTask.dayNumber, { articleTitle: e.target.value })}
                    placeholder="e.g. Ground control — reading Part C"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown on the candidate &quot;Today&apos;s reading passage&quot; card and article page.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`article-description-${selectedTask.dayNumber}`}>Description</Label>
                  <Textarea
                    id={`article-description-${selectedTask.dayNumber}`}
                    value={selectedTask.summary || ""}
                    onChange={(e) => onUpdate(selectedTask.dayNumber, { summary: e.target.value })}
                    placeholder="Short summary shown under the title on the reading passage card…"
                    rows={3}
                    className="min-h-[88px] resize-y"
                  />
                </div>
                <div className="space-y-3 rounded-xl border border-dashed border-primary/25 bg-primary/[0.04] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Article PDF</p>
                      <p className="text-xs text-muted-foreground">
                        Candidates can read and download this PDF in the portal. PDF only.
                      </p>
                    </div>
                  </div>
                  {(selectedTask.articlePdfAssetId || selectedTask.articlePdfAsset) &&
                  selectedTask.articlePdfAsset?.title ? (
                    <p className="truncate rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground">
                      {selectedTask.articlePdfAsset.title}
                    </p>
                  ) : null}
                  <input
                    ref={articlePdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => void uploadArticlePdf(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!token || articlePdfUploadProgress != null}
                      onClick={() => articlePdfInputRef.current?.click()}
                    >
                      {selectedTask.articlePdfAssetId || selectedTask.articlePdfAsset
                        ? "Replace PDF"
                        : "Upload PDF"}
                    </Button>
                    {articlePdfUploadProgress != null ? (
                      <UploadProgressRing value={articlePdfUploadProgress} label="Uploading PDF…" />
                    ) : null}
                    {selectedTask.articlePdfAssetId || selectedTask.articlePdfAsset ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={clearArticlePdf}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove file
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="assignments"
            className="overflow-hidden rounded-[16px] border border-border border-b-0 bg-muted/40 px-4 data-[state=open]:shadow-[var(--shadow-card)]"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-3 text-left">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardList className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-display text-base font-semibold">Assignments</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Reading and listening tests from Test Builder
                  </span>
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 pt-0">
              <div className="max-w-md space-y-4 rounded-2xl border border-border/50 bg-card/70 p-4">
                <div className="space-y-2">
                  <Label>Reading test</Label>
                  <Select
                    value={selectedTask.assignedReadingTestId || emptyTestValue}
                    onValueChange={(value) =>
                      onUpdate(selectedTask.dayNumber, {
                        assignedReadingTestId: value === emptyTestValue ? "" : value
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reading test" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={emptyTestValue}>No reading test</SelectItem>
                      {readingTestOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Listening test</Label>
                  <Select
                    value={selectedTask.assignedListeningTestId || emptyTestValue}
                    onValueChange={(value) =>
                      onUpdate(selectedTask.dayNumber, {
                        assignedListeningTestId: value === emptyTestValue ? "" : value
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select listening test" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={emptyTestValue}>No listening test</SelectItem>
                      {listeningTestOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="cheat-sheet"
            className="overflow-hidden rounded-[16px] border border-border border-b-0 bg-muted/40 px-4 data-[state=open]:shadow-[var(--shadow-card)]"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-3 text-left">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-display text-base font-semibold">Cheat Sheet</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    PDF reference sheet shown to candidates for this day
                  </span>
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 pt-0">
              <div className="space-y-3 rounded-2xl border border-border/50 bg-card/70 p-4">
                <div className="space-y-3 rounded-xl border border-dashed border-primary/25 bg-primary/[0.04] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Cheat sheet PDF (optional)</p>
                      <p className="text-xs text-muted-foreground">
                        Candidates can open or download this from the portal. PDF only.
                      </p>
                    </div>
                  </div>
                  {(selectedTask.cheatSheetAssetId || selectedTask.cheatSheetAsset) &&
                  selectedTask.cheatSheetAsset?.title ? (
                    <p className="truncate rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground">
                      {selectedTask.cheatSheetAsset.title}
                    </p>
                  ) : null}
                  <input
                    ref={cheatSheetInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => void uploadCheatSheet(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!token || cheatSheetUploadProgress != null}
                      onClick={() => cheatSheetInputRef.current?.click()}
                    >
                      {selectedTask.cheatSheetAssetId || selectedTask.cheatSheetAsset
                        ? "Replace PDF"
                        : "Upload PDF"}
                    </Button>
                    {cheatSheetUploadProgress != null ? (
                      <UploadProgressRing value={cheatSheetUploadProgress} label="Uploading PDF…" />
                    ) : null}
                    {selectedTask.cheatSheetAssetId || selectedTask.cheatSheetAsset ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={clearCheatSheet}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove file
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
