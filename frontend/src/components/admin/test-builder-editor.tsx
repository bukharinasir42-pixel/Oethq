"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Save, Trash2, UploadCloud } from "lucide-react";
import { RouteLoadingScreen } from "@/components/loaders";
import { UploadProgressRing } from "@/components/loaders/upload-progress-ring";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { apiFetch, apiUpload } from "@/lib/api";
import { isRichContentEmpty } from "@/lib/rich-content";
import { FillBlankPromptEditor } from "@/components/admin/fill-blank-prompt-editor";
import { McqAnswerEditor } from "@/components/admin/mcq-answer-editor";
import { ListeningCandidatePreview } from "@/components/admin/listening-candidate-preview";
import { ListeningPartAQuestionHeadingGroupsEditor } from "@/components/admin/listening-part-a-question-heading-groups-editor";
import { PastPaperPublicationPanel } from "@/components/admin/past-paper-publication-panel";
import { ReadingBookletEditor } from "@/components/admin/reading-booklet-editor";
import { ReadingMdxEditor } from "@/components/editor/reading-mdx-editor";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import {
  normalizePartBExtractBooklets,
  resolveReadingPartBExtractId,
  serializePartBExtractBooklets
} from "@/lib/reading-part-b-booklets";
import {
  normalizePartCExtractBooklets,
  resolveReadingPartCExtractId,
  serializePartCExtractBooklets
} from "@/lib/reading-part-c-booklets";
import {
  normalizeListeningPartAExtractQuestionHeadings,
  normalizeListeningPartCExtractQuestionHeadings,
  resolveListeningPartAExtractId,
  resolveListeningPartCExtractId,
  serializeListeningPartAExtractQuestionHeadings,
  serializeListeningPartCExtractQuestionHeadings
} from "@/lib/listening-extract-question-headings";
import {
  buildDefaultListeningPartAQuestionHeadingGroups,
  normalizeListeningPartAQuestionHeadingGroups,
  serializeListeningPartAQuestionHeadingGroups,
  validateListeningPartAQuestionHeadingGroups,
  type ListeningPartAQuestionHeadingGroupsByExtract
} from "@/lib/listening-part-a-question-heading-groups";
import {
  buildQuestionTemplate,
  getListeningPartAExtractGroups,
  getListeningPartBExtractGroups,
  getListeningPartCExtractGroups,
  getPartCExtractGroups,
  getPartExtractGroups,
  resolveReadingQuestionExtractId,
  type PartExtractGroup
} from "@/lib/test-question-templates";
import type { PastPaperSummaryDto, StorageAssetDto, TestDetailDto, TestQuestionDto } from "@/lib/types";

type EditableQuestion = TestQuestionDto & {
  correctAnswer: string;
};

type AdminLoadedTest = {
  id: string;
  type: "LISTENING" | "READING";
  title: string;
  description?: string | null;
  instructions?: string | null;
  partASubInstructions?: string | null;
  partBSubInstructions?: string | null;
  partCSubInstructions?: string | null;
  partABookletHtml?: string | null;
  partBBookletHtml?: string | null;
  partBExtractBooklets?: Record<string, string> | null;
  partAExtractQuestionHeadings?: Record<string, string> | null;
  partAQuestionHeadingGroups?: Record<
    string,
    Array<{ id: string; heading: string; questionSequences: number[] }>
  > | null;
  partCExtractQuestionHeadings?: Record<string, string> | null;
  partCBookletHtml?: string | null;
  partCExtractBooklets?: Record<string, string> | null;
  totalQuestions: number;
  timerDuration: number;
  partATimer?: number | null;
  partBCTimer?: number | null;
  isPublished: boolean;
  audioAsset?: StorageAssetDto | null;
  linkedPastPaper?: PastPaperSummaryDto | null;
  questions: TestQuestionDto[];
};

function getAssetPreviewUrl(asset?: StorageAssetDto | null) {
  return asset?.signedUrl?.trim() || asset?.publicUrl?.trim() || "";
}

type ReadingBookletDraft = {
  partA: string;
  partB: Record<string, string>;
  partC: Record<string, string>;
};

function createReadingBookletDraft(source?: {
  partABookletHtml?: string | null;
  partBBookletHtml?: string | null;
  partBExtractBooklets?: Record<string, string> | null;
  partCExtractBooklets?: Record<string, string> | null;
  partCBookletHtml?: string | null;
}): ReadingBookletDraft {
  return {
    partA: source?.partABookletHtml || "",
    partB: normalizePartBExtractBooklets(source?.partBExtractBooklets, source?.partBBookletHtml),
    partC: normalizePartCExtractBooklets(source?.partCExtractBooklets, source?.partCBookletHtml)
  };
}

type ListeningHeadingsDraft = {
  partA: Record<string, string>;
  partAGroups: ListeningPartAQuestionHeadingGroupsByExtract;
  partC: Record<string, string>;
};

function createListeningHeadingsDraft(source?: {
  partAExtractQuestionHeadings?: Record<string, string> | null;
  partAQuestionHeadingGroups?: ListeningPartAQuestionHeadingGroupsByExtract | null;
  partCExtractQuestionHeadings?: Record<string, string> | null;
}): ListeningHeadingsDraft {
  return {
    partA: normalizeListeningPartAExtractQuestionHeadings(source?.partAExtractQuestionHeadings),
    partAGroups: normalizeListeningPartAQuestionHeadingGroups(source?.partAQuestionHeadingGroups),
    partC: normalizeListeningPartCExtractQuestionHeadings(source?.partCExtractQuestionHeadings)
  };
}

type EditableTest = {
  id?: string;
  type: "LISTENING" | "READING";
  title: string;
  description: string;
  instructions: string;
  partASubInstructions: string;
  partBSubInstructions: string;
  partCSubInstructions: string;
  partABookletHtml: string;
  partBBookletHtml: string;
  partBExtractBooklets: Record<string, string>;
  partCExtractBooklets: Record<string, string>;
  partAExtractQuestionHeadings: Record<string, string>;
  partAQuestionHeadingGroups: ListeningPartAQuestionHeadingGroupsByExtract;
  partCExtractQuestionHeadings: Record<string, string>;
  totalQuestions: number;
  timerDuration: number;
  partATimer: number;
  partBCTimer: number;
  audioAssetId?: string;
  audioAsset?: StorageAssetDto | null;
  isPublished: boolean;
  questions: EditableQuestion[];
};

async function getAudioDurationMinutes(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const durationSeconds = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(new Error("Could not read audio duration"));
      audio.src = url;
    });
    return Math.max(1, Math.ceil(durationSeconds / 60));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildEmptyTest(type: "LISTENING" | "READING" = "LISTENING"): EditableTest {
  return {
    type,
    title: "",
    description: "",
    instructions:
      type === "LISTENING"
        ? "Listen once per extract. No pause or rewind. The attempt auto-submits 10 seconds after the final audio ends."
        : "Part A: 20 fill-in-the-blank questions, 15 minutes (auto-submit). Parts B and C: 45 minutes shared. Part B is one MCQ at a time with the booklet.",
    partASubInstructions: "",
    partBSubInstructions: "",
    partCSubInstructions: "",
    partABookletHtml: "",
    partBBookletHtml: "",
    partBExtractBooklets: normalizePartBExtractBooklets(),
    partCExtractBooklets: normalizePartCExtractBooklets(),
    partAExtractQuestionHeadings: normalizeListeningPartAExtractQuestionHeadings(),
    partAQuestionHeadingGroups: buildDefaultListeningPartAQuestionHeadingGroups(),
    partCExtractQuestionHeadings: normalizeListeningPartCExtractQuestionHeadings(),
    totalQuestions: 42,
    timerDuration: type === "LISTENING" ? 1 : 60,
    partATimer: 15,
    partBCTimer: 45,
    isPublished: false,
    questions: buildQuestionTemplate(type)
  };
}

type TestBuilderEditorProps = {
  testId?: string;
  initialType: "LISTENING" | "READING";
  suggestedTitle: string;
  backHref?: string;
  backLabel?: string;
  shellTitle?: string;
  shellDescription?: string;
  pastPaperId?: string;
};

export function TestBuilderEditor({
  testId,
  initialType,
  suggestedTitle,
  backHref = "/admin/test-builder",
  backLabel = "Back to tests",
  shellTitle = "Test Builder",
  shellDescription = "Author question banks, manage OET timers, upload exam assets, and publish candidate-facing tests.",
  pastPaperId
}: TestBuilderEditorProps) {
  const router = useRouter();
  const { token, profile, status, error, logout, refresh } = useSession();
  const [form, setForm] = useState<EditableTest>(() => ({
    ...buildEmptyTest(initialType),
    title: suggestedTitle
  }));
  const [loadingTest, setLoadingTest] = useState(Boolean(testId));
  const [loadingPastPaper, setLoadingPastPaper] = useState(Boolean(pastPaperId));
  const [pastPaper, setPastPaper] = useState<PastPaperSummaryDto | null>(null);
  const effectivePastPaperId = pastPaperId ?? pastPaper?.id;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState<"audio" | "booklet" | string | null>(null);
  const [audioUploadProgress, setAudioUploadProgress] = useState<number | null>(null);
  const [listeningPreviewOpen, setListeningPreviewOpen] = useState(false);
  const [bookletEditorSeed, setBookletEditorSeed] = useState(0);
  const readingBookletDraftRef = useRef<ReadingBookletDraft>(
    createReadingBookletDraft(buildEmptyTest(initialType))
  );
  const listeningHeadingsDraftRef = useRef<ListeningHeadingsDraft>(
    createListeningHeadingsDraft(buildEmptyTest(initialType))
  );

  const hydrateForm = (test: AdminLoadedTest) => {
    readingBookletDraftRef.current = createReadingBookletDraft({
      partABookletHtml: test.partABookletHtml,
      partBBookletHtml: test.partBBookletHtml,
      partBExtractBooklets: test.partBExtractBooklets,
      partCExtractBooklets: test.partCExtractBooklets,
      partCBookletHtml: test.partCBookletHtml
    });
    listeningHeadingsDraftRef.current = createListeningHeadingsDraft({
      partAExtractQuestionHeadings: test.partAExtractQuestionHeadings,
      partAQuestionHeadingGroups: test.partAQuestionHeadingGroups,
      partCExtractQuestionHeadings: test.partCExtractQuestionHeadings
    });

    setForm({
      id: test.id,
      type: test.type,
      title: test.title,
      description: test.description || "",
      instructions: test.instructions || "",
      partASubInstructions: test.partASubInstructions || "",
      partBSubInstructions: test.partBSubInstructions || "",
      partCSubInstructions: test.partCSubInstructions || "",
      partABookletHtml: test.partABookletHtml || "",
      partBBookletHtml: test.partBBookletHtml || "",
      partBExtractBooklets: normalizePartBExtractBooklets(test.partBExtractBooklets, test.partBBookletHtml),
      partCExtractBooklets: normalizePartCExtractBooklets(test.partCExtractBooklets, test.partCBookletHtml),
      partAExtractQuestionHeadings: normalizeListeningPartAExtractQuestionHeadings(
        test.partAExtractQuestionHeadings
      ),
      partAQuestionHeadingGroups: normalizeListeningPartAQuestionHeadingGroups(
        test.partAQuestionHeadingGroups
      ),
      partCExtractQuestionHeadings: normalizeListeningPartCExtractQuestionHeadings(
        test.partCExtractQuestionHeadings
      ),
      totalQuestions: test.totalQuestions,
      timerDuration: test.timerDuration,
      partATimer: test.partATimer || 15,
      partBCTimer: test.partBCTimer || 45,
      audioAssetId: test.audioAsset?.id,
      audioAsset: test.audioAsset || null,
      isPublished: test.isPublished,
      questions: test.questions.map((question) => ({
        ...question,
        extractId:
          test.type === "READING" ? resolveReadingQuestionExtractId(question) : question.extractId,
        correctAnswer: question.correctAnswer || ""
      }))
    });
    setPastPaper((current) => {
      const base = test.linkedPastPaper ?? current;
      if (!base || !test.id) {
        return base ?? current;
      }
      if (base.listeningTest.id === test.id) {
        return { ...base, listeningTest: { ...base.listeningTest, isPublished: test.isPublished } };
      }
      if (base.readingTest.id === test.id) {
        return { ...base, readingTest: { ...base.readingTest, isPublished: test.isPublished } };
      }
      return base;
    });
    if (test.linkedPastPaper) {
      setLoadingPastPaper(false);
    }
    setBookletEditorSeed((current) => current + 1);
  };

  useEffect(() => {
    if (!token || !testId) {
      setLoadingTest(false);
      return;
    }

    const load = async () => {
      setLoadingTest(true);
      try {
        const response = await apiFetch<TestDetailDto>(`/tests/admin/${testId}`, { token });
        hydrateForm(response);
      } catch (caughtError: unknown) {
        toast.error(caughtError instanceof Error ? caughtError.message : "Failed to load test");
        router.push(backHref);
      } finally {
        setLoadingTest(false);
      }
    };

    void load();
  }, [backHref, router, testId, token]);

  useEffect(() => {
    if (!token || !pastPaperId) {
      setLoadingPastPaper(false);
      return;
    }

    const loadPastPaper = async () => {
      setLoadingPastPaper(true);
      try {
        const response = await apiFetch<PastPaperSummaryDto>(`/past-papers/admin/${pastPaperId}`, { token });
        setPastPaper(response);
      } catch (caughtError: unknown) {
        toast.error(caughtError instanceof Error ? caughtError.message : "Failed to load past paper");
      } finally {
        setLoadingPastPaper(false);
      }
    };

    void loadPastPaper();
  }, [pastPaperId, token]);

  const handlePastPaperChange = (next: PastPaperSummaryDto) => {
    setPastPaper(next);
    if (form.id === next.listeningTest.id) {
      setForm((current) => ({ ...current, isPublished: next.listeningTest.isPublished ?? false }));
      return;
    }
    if (form.id === next.readingTest.id) {
      setForm((current) => ({ ...current, isPublished: next.readingTest.isPublished ?? false }));
    }
  };

  const updateQuestion = (sequence: number, patch: Partial<EditableQuestion>) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.sequence === sequence ? { ...question, ...patch } : question
      )
    }));
  };

  const saveTest = async () => {
    setSaving(true);
    try {
      const bookletDraft = readingBookletDraftRef.current;
      const partAGroupsSource = form.partAQuestionHeadingGroups;
      const partAExtractHeadingsSource = form.partAExtractQuestionHeadings;
      const partCExtractHeadingsSource = form.partCExtractQuestionHeadings;

      listeningHeadingsDraftRef.current = {
        partA: partAExtractHeadingsSource,
        partAGroups: partAGroupsSource,
        partC: partCExtractHeadingsSource
      };

      if (form.type === "LISTENING") {
        const validationError = validateListeningPartAQuestionHeadingGroups(partAGroupsSource);
        if (validationError) {
          toast.error(validationError);
          setSaving(false);
          return;
        }
      }

      const serializedPartAGroups =
        form.type === "LISTENING"
          ? serializeListeningPartAQuestionHeadingGroups(partAGroupsSource)
          : undefined;

      const payload = {
        type: form.type,
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        partASubInstructions: form.partASubInstructions || undefined,
        partBSubInstructions: form.partBSubInstructions || undefined,
        partCSubInstructions: form.partCSubInstructions || undefined,
        partABookletHtml:
          form.type === "READING"
            ? isRichContentEmpty(bookletDraft.partA)
              ? null
              : bookletDraft.partA.trim()
            : undefined,
        partBBookletHtml: form.type === "READING" ? null : undefined,
        partBExtractBooklets:
          form.type === "READING" ? serializePartBExtractBooklets(bookletDraft.partB) : undefined,
        partCExtractBooklets:
          form.type === "READING" ? serializePartCExtractBooklets(bookletDraft.partC) : undefined,
        partAExtractQuestionHeadings:
          form.type === "LISTENING"
            ? serializeListeningPartAExtractQuestionHeadings(partAExtractHeadingsSource)
            : undefined,
        partAQuestionHeadingGroups: serializedPartAGroups,
        partCExtractQuestionHeadings:
          form.type === "LISTENING"
            ? serializeListeningPartCExtractQuestionHeadings(partCExtractHeadingsSource)
            : undefined,
        totalQuestions: form.totalQuestions,
        timerDuration: form.timerDuration,
        partATimer: form.type === "READING" ? form.partATimer : undefined,
        partBCTimer: form.type === "READING" ? form.partBCTimer : undefined,
        audioAssetId: form.type === "LISTENING" ? form.audioAssetId : undefined,
        isPublished: form.isPublished,
        questions: form.questions.map((question) => ({
          id: question.id || undefined,
          sequence: question.sequence,
          part: question.part,
          extractId:
            form.type === "READING"
              ? resolveReadingQuestionExtractId(question)
              : question.extractId || undefined,
          type: question.type,
          content: question.content,
          options: question.options || undefined,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation || undefined,
          points: question.points
        }))
      };

      if (form.id) {
        const response = await apiFetch<TestDetailDto>(`/tests/${form.id}`, {
          method: "PUT",
          token,
          body: payload
        });
        hydrateForm(response);
        toast.success("Test updated");
      } else {
        const response = await apiFetch<TestDetailDto>("/tests", {
          method: "POST",
          token,
          body: payload
        });
        hydrateForm(response);
        toast.success("Test created");
        if (!effectivePastPaperId) {
          router.replace(`/admin/test-builder/${response.id}`);
        }
      }
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to save test");
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async () => {
    if (!form.id) {
      toast.error("Save the test before publishing");
      return;
    }

    try {
      const response = await apiFetch<TestDetailDto>(`/tests/${form.id}/publish`, {
        method: "PUT",
        token,
        body: { isPublished: !form.isPublished }
      });
      hydrateForm(response);
      toast.success(response.isPublished ? "Test published" : "Test moved to draft");
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to update publish status");
    }
  };

  const uploadAudio = async (file: File | null) => {
    if (!file) return;
    setUploading("audio");
    setAudioUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      const durationMinutes = await getAudioDurationMinutes(file);
      const asset = await apiUpload<StorageAssetDto>("/storage/upload/AUDIO", formData, {
        token,
        onProgress: setAudioUploadProgress
      } as Parameters<typeof apiUpload>[2]);
      setForm((current) => ({
        ...current,
        audioAssetId: asset.id,
        audioAsset: asset,
        timerDuration: durationMinutes ?? current.timerDuration
      }));
      toast.success("Audio uploaded");
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Upload failed");
    } finally {
      setUploading(null);
      setAudioUploadProgress(null);
    }
  };

  const deleteTest = async () => {
    if (!form.id || !token) return;
    setDeleting(true);
    try {
      if (effectivePastPaperId) {
        await apiFetch(`/past-papers/${effectivePastPaperId}`, { method: "DELETE", token });
        toast.success("Past paper deleted");
      } else {
        await apiFetch(`/tests/${form.id}`, { method: "DELETE", token });
        toast.success("Test deleted");
      }
      router.push(backHref);
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to delete test");
    } finally {
      setDeleting(false);
    }
  };

  const questionGroups = useMemo(
    () => ({
      A: form.questions.filter((question) => question.part === "A"),
      B: form.questions.filter((question) => question.part === "B"),
      C: form.questions.filter((question) => question.part === "C")
    }),
    [form.questions]
  );

  const partCExtractGroups = useMemo(
    () => getPartCExtractGroups(form.questions, form.type),
    [form.questions, form.type]
  );

  const readingPartBExtractGroups = useMemo((): PartExtractGroup<EditableQuestion>[] => {
    if (form.type !== "READING") return [];
    return getPartExtractGroups(form.questions, "B", "READING");
  }, [form.questions, form.type]);

  const readingPartCExtractGroups = useMemo((): PartExtractGroup<EditableQuestion>[] => {
    if (form.type !== "READING") return [];
    return getPartCExtractGroups(form.questions, "READING");
  }, [form.questions, form.type]);

  const listeningPartAExtractGroups = useMemo(
    () => (form.type === "LISTENING" ? getListeningPartAExtractGroups(form.questions) : []),
    [form.questions, form.type]
  );

  const listeningPartBExtractGroups = useMemo(
    () => (form.type === "LISTENING" ? getListeningPartBExtractGroups(form.questions) : []),
    [form.questions, form.type]
  );

  const listeningPartCExtractGroups = useMemo(
    () => (form.type === "LISTENING" ? getListeningPartCExtractGroups(form.questions) : []),
    [form.questions, form.type]
  );

  if (status === "loading" || status === "idle" || loadingTest || loadingPastPaper) {
    return <WorkspaceLoadingState title="Loading test..." layout="editor" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to manage Listening and Reading tests."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const renderListeningSessionAudio = () => {
    const playbackUrl = getAssetPreviewUrl(form.audioAsset);

    return (
      <div className="surface-panel-subtle space-y-2 p-3">
        <Label htmlFor="listening-session-audio">Listening session audio (optional)</Label>
        <div className="surface-panel-dashed space-y-3 p-3">
          <Input
            id="listening-session-audio"
            type="file"
            accept="audio/*"
            disabled={uploading !== null}
            onChange={(event) => void uploadAudio(event.target.files?.[0] || null)}
          />
          <p className="text-xs text-muted-foreground">
            {uploading === "audio" && audioUploadProgress != null ? (
              <UploadProgressRing value={audioUploadProgress} label="Uploading audioΓÇª" />
            ) : form.audioAsset ? (
              `Attached: ${form.audioAsset.title} ┬╖ ${form.timerDuration} min window`
            ) : (
              "Optional. Upload one audio file for the full listening session ΓÇö duration sets the exam timer when attached."
            )}
          </p>
          {playbackUrl ? (
            <audio key={playbackUrl} controls preload="metadata" className="w-full" src={playbackUrl}>
              Your browser does not support audio playback.
            </audio>
          ) : null}
        </div>
      </div>
    );
  };

  const partSubInstructionsField = {
    A: "partASubInstructions",
    B: "partBSubInstructions",
    C: "partCSubInstructions"
  } as const;

  const renderPartSubInstructions = (part: "A" | "B" | "C") => {
    const field = partSubInstructionsField[part];
    const useMdxEditor = form.type === "READING";

    return (
      <div className="surface-panel-subtle space-y-2 p-3">
        <Label htmlFor={`part-instructions-${part}`}>Part {part} instructions</Label>
        <p className="text-xs text-muted-foreground">
          Shown to candidates above question 1 when they start Part {part}. Example: &quot;Part {part} has short
          extracts.&quot;
        </p>
        {useMdxEditor ? (
          <ReadingMdxEditor
            id={`part-instructions-${part}`}
            minHeight="sm"
            value={form[field]}
            onChange={(markdown) => setForm((current) => ({ ...current, [field]: markdown }))}
            placeholder={`Write Part ${part} instructions for candidatesΓÇª`}
          />
        ) : (
          <RichTextEditor
            id={`part-instructions-${part}`}
            minHeight="sm"
            value={form[field]}
            onChange={(html) => setForm((current) => ({ ...current, [field]: html }))}
            placeholder={`Write Part ${part} instructions for candidatesΓÇª`}
          />
        )}
      </div>
    );
  };

  const renderPartBookletEditor = (part: "A" | "B" | "C") => {
    if (form.type !== "READING" || part !== "A") return null;

    return (
      <ReadingBookletEditor
        key={`part-a-booklet-${bookletEditorSeed}`}
        part="A"
        value={form.partABookletHtml}
        contentSeed={bookletEditorSeed}
        onChange={(markdown) => {
          if (!markdown.trim() && readingBookletDraftRef.current.partA.trim()) return;
          readingBookletDraftRef.current.partA = markdown;
          setForm((current) => ({ ...current, partABookletHtml: markdown }));
        }}
      />
    );
  };

  const renderReadingPartBExtractBooklet = (extractId: string, questionSequence: number, extractNumber: number) => (
    <ReadingBookletEditor
      key={`part-b-booklet-${extractId}-${bookletEditorSeed}`}
      part="B"
      value={form.partBExtractBooklets[extractId] || ""}
      contentSeed={bookletEditorSeed}
      onChange={(markdown) => {
        if (!markdown.trim() && (readingBookletDraftRef.current.partB[extractId] || "").trim()) return;
        readingBookletDraftRef.current.partB = {
          ...readingBookletDraftRef.current.partB,
          [extractId]: markdown
        };
        setForm((current) => ({
          ...current,
          partBExtractBooklets: {
            ...current.partBExtractBooklets,
            [extractId]: markdown
          }
        }));
      }}
      bookletLabel={`Extract ${extractNumber} booklet`}
      bookletHint={`Reading passage shown with Question ${questionSequence} in Extract ${extractNumber}.`}
      editorId={`part-b-booklet-${extractId}`}
    />
  );

  const renderReadingPartCExtractBooklet = (
    extractId: string,
    questionRange: string,
    extractNumber: number
  ) => (
    <ReadingBookletEditor
      key={`part-c-booklet-${extractId}-${bookletEditorSeed}`}
      part="C"
      value={form.partCExtractBooklets[extractId] || ""}
      contentSeed={bookletEditorSeed}
      onChange={(markdown) => {
        if (!markdown.trim() && (readingBookletDraftRef.current.partC[extractId] || "").trim()) return;
        readingBookletDraftRef.current.partC = {
          ...readingBookletDraftRef.current.partC,
          [extractId]: markdown
        };
        setForm((current) => ({
          ...current,
          partCExtractBooklets: {
            ...current.partCExtractBooklets,
            [extractId]: markdown
          }
        }));
      }}
      bookletLabel={`Extract ${extractNumber} booklet`}
      bookletHint={`Reading passage shown for ${questionRange} in Extract ${extractNumber}.`}
      editorId={`part-c-booklet-${extractId}`}
    />
  );

  const renderListeningPartAExtractQuestionHeading = (
    extractId: string,
    extractNumber: number,
    questionRange: string
  ) => {
    const resolvedId = resolveListeningPartAExtractId(extractId, extractNumber - 1);

    return (
      <div className="surface-panel-subtle space-y-2 p-3">
        <Label htmlFor={`listening-extract-heading-${resolvedId}`}>Questions heading</Label>
        <p className="text-xs text-muted-foreground">
          Shown once above all questions for Extract {extractNumber} ({questionRange}) on the candidate test. This is
          separate from the per-group question headings below.
        </p>
        <RichTextEditor
          id={`listening-extract-heading-${resolvedId}`}
          minHeight="sm"
          value={form.partAExtractQuestionHeadings[resolvedId] || ""}
          onChange={(html) => {
            listeningHeadingsDraftRef.current.partA = {
              ...listeningHeadingsDraftRef.current.partA,
              [resolvedId]: html
            };
            setForm((current) => ({
              ...current,
              partAExtractQuestionHeadings: { ...current.partAExtractQuestionHeadings, [resolvedId]: html }
            }));
          }}
          placeholder={`Write the extract questions heading for Extract ${extractNumber}…`}
        />
      </div>
    );
  };

  const renderListeningPartAQuestionHeadingGroups = (
    extractId: string,
    extractNumber: number,
    questionRange: string
  ) => {
    const resolvedId = resolveListeningPartAExtractId(extractId, extractNumber - 1);
    const groups = form.partAQuestionHeadingGroups[resolvedId] ?? [];

    return (
      <ListeningPartAQuestionHeadingGroupsEditor
        extractId={resolvedId}
        extractNumber={extractNumber}
        questionRange={questionRange}
        groups={groups}
        onChange={(nextGroups) => {
          listeningHeadingsDraftRef.current.partAGroups = {
            ...listeningHeadingsDraftRef.current.partAGroups,
            [resolvedId]: nextGroups
          };
          setForm((current) => ({
            ...current,
            partAQuestionHeadingGroups: {
              ...current.partAQuestionHeadingGroups,
              [resolvedId]: nextGroups
            }
          }));
        }}
      />
    );
  };

  const renderListeningExtractQuestionHeading = (
    extractId: string,
    extractNumber: number,
    questionRange: string
  ) => {
    const resolvedId = resolveListeningPartCExtractId(extractId, extractNumber - 1);

    return (
      <div className="surface-panel-subtle space-y-2 p-3">
        <Label htmlFor={`listening-heading-${resolvedId}`}>Questions heading</Label>
        <p className="text-xs text-muted-foreground">
          Shown above the questions for Extract {extractNumber} ({questionRange}) when candidates take this listening
          test.
        </p>
        <RichTextEditor
          id={`listening-heading-${resolvedId}`}
          minHeight="sm"
          value={form.partCExtractQuestionHeadings[resolvedId] || ""}
          onChange={(html) => {
            listeningHeadingsDraftRef.current.partC = {
              ...listeningHeadingsDraftRef.current.partC,
              [resolvedId]: html
            };
            setForm((current) => ({
              ...current,
              partCExtractQuestionHeadings: { ...current.partCExtractQuestionHeadings, [resolvedId]: html }
            }));
          }}
          placeholder={`Write the questions heading for Extract ${extractNumber}…`}
        />
      </div>
    );
  };

  const renderQuestionEditor = (question: EditableQuestion) => (
    <AccordionItem key={question.sequence} value={`question-${question.sequence}`}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-wrap items-center gap-2 text-left">
          <Badge variant="outline">Q{question.sequence}</Badge>
          <Badge variant="outline">Part {question.part}</Badge>
          <Badge variant="outline">{question.type}</Badge>
          <span className="truncate text-sm text-muted-foreground">{question.content || "Untitled question"}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3">
        {question.type === "FILL_BLANK" ? (
          <FillBlankPromptEditor
            id={`question-prompt-${question.sequence}`}
            value={question.content}
            onChange={(content) => updateQuestion(question.sequence, { content })}
          />
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`question-prompt-${question.sequence}`}>Question prompt</Label>
            <Input
              id={`question-prompt-${question.sequence}`}
              value={question.content}
              onChange={(event) => updateQuestion(question.sequence, { content: event.target.value })}
              placeholder="Enter the question text"
            />
          </div>
        )}
        {question.type === "MCQ" ? (
          <McqAnswerEditor
            sequence={question.sequence}
            optionCount={question.part === "C" && form.type === "READING" ? 4 : 3}
            options={
              question.options ||
              (question.part === "C" && form.type === "READING"
                ? ["Option A", "Option B", "Option C", "Option D"]
                : ["Option A", "Option B", "Option C"])
            }
            correctAnswer={question.correctAnswer}
            onOptionsChange={(options) => updateQuestion(question.sequence, { options })}
            onCorrectAnswerChange={(correctAnswer) => updateQuestion(question.sequence, { correctAnswer })}
          />
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`correct-answer-${question.sequence}`}>Correct answer</Label>
            <Input
              id={`correct-answer-${question.sequence}`}
              placeholder={
                form.type === "READING" && question.part === "A" && question.sequence <= 6
                  ? "One character (e.g. A)"
                  : "Correct answer"
              }
              maxLength={form.type === "READING" && question.part === "A" && question.sequence <= 6 ? 1 : undefined}
              value={question.correctAnswer}
              onChange={(event) =>
                updateQuestion(question.sequence, {
                  correctAnswer:
                    form.type === "READING" && question.part === "A" && question.sequence <= 6
                      ? event.target.value.slice(0, 1)
                      : event.target.value
                })
              }
            />
            {form.type === "READING" && question.part === "A" && question.sequence <= 6 ? (
              <p className="text-xs text-muted-foreground">Questions 1-6 accept a single character answer.</p>
            ) : null}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <AdminShell
      title={shellTitle}
      description={shellDescription}
      profile={profile}
      compact
      fillContent
      onRefresh={refresh}
      onLogout={logout}
    >
      <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CardHeader className="space-y-2 border-b border-border/70 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-2 -ml-2 cursor-pointer"
                  onClick={() => router.push(backHref)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {backLabel}
                </Button>
                <CardTitle className="text-lg">{form.id ? "Edit test" : "Create test"}</CardTitle>
                <CardDescription>
                  {form.type === "LISTENING" ? "Listening" : "Reading"} ┬╖ {form.title || "Untitled"}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.id ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="cursor-pointer text-destructive hover:text-destructive" disabled={deleting}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {effectivePastPaperId ? "Delete this past paper?" : "Delete this test?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {effectivePastPaperId
                            ? "This removes the entire past paper bundle, including both listening and reading tests. This cannot be undone."
                            : "This removes the test and unlinks it from daily tasks. This cannot be undone."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => void deleteTest()}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
                {!effectivePastPaperId ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="cursor-pointer">
                        {form.isPublished ? "Move to draft" : "Publish"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {form.isPublished ? "Move this test back to draft?" : "Publish this test?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Candidate visibility depends on this setting. Review timers, assets, and answer keys before
                          confirming.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void togglePublished()}>Confirm</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
                {form.type === "LISTENING" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer gap-1.5"
                    onClick={() => setListeningPreviewOpen(true)}
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    Candidate preview
                  </Button>
                ) : null}
                <Button className="cursor-pointer" onClick={() => void saveTest()} disabled={saving}>
                  <span className="inline-flex items-center gap-2">
                    <Save className="h-4 w-4" aria-hidden />
                    {saving ? "Saving…" : "Save test"}
                  </span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {effectivePastPaperId && pastPaper && token ? (
                  <PastPaperPublicationPanel
                    pastPaper={pastPaper}
                    pastPaperId={effectivePastPaperId}
                    currentTestId={form.id}
                    token={token}
                    onPastPaperChange={handlePastPaperChange}
                  />
                ) : null}
                <div className="surface-panel-subtle space-y-2 p-3">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </div>

                <div className="surface-panel-subtle space-y-2 p-3">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={3}
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </div>

                <div className="surface-panel-subtle space-y-2 p-3">
                  <Label htmlFor="instructions">Pre-test instructions (optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Shown once on the start screen before the attempt begins. During the exam, use Part A/B/C
                    instructions in each part tab instead.
                  </p>
                  <RichTextEditor
                    id="instructions"
                    minHeight="sm"
                    value={form.instructions}
                    onChange={(html) => setForm((current) => ({ ...current, instructions: html }))}
                    placeholder="Write instructions for candidatesΓÇª"
                  />
                </div>

                {form.type === "LISTENING" ? (
                  renderListeningSessionAudio()
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="surface-panel-subtle space-y-2 p-3">
                      <Label htmlFor="timer">Total timer (minutes)</Label>
                      <Input
                        id="timer"
                        type="number"
                        value={form.timerDuration}
                        readOnly
                        disabled
                        className="cursor-not-allowed opacity-80"
                      />
                    </div>
                    <div className="surface-panel-subtle space-y-2 p-3">
                      <Label htmlFor="part-a">Part A timer</Label>
                      <Input
                        id="part-a"
                        type="number"
                        value={form.partATimer}
                        readOnly
                        disabled
                        className="cursor-not-allowed opacity-80"
                      />
                    </div>
                    <div className="surface-panel-subtle space-y-2 p-3">
                      <Label htmlFor="part-bc">Part B + C timer</Label>
                      <Input
                        id="part-bc"
                        type="number"
                        value={form.partBCTimer}
                        readOnly
                        disabled
                        className="cursor-not-allowed opacity-80"
                      />
                    </div>
                  </div>
                )}

                <div className="surface-panel-subtle flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Question bank template</p>
                    <p className="text-xs text-muted-foreground">
                      Resetting recreates the generated 42-question scaffold for the current test type.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="cursor-pointer">
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Reset template
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset the question template?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will replace the current question list with the generated scaffold for the selected test type.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            setForm((current) => ({ ...current, questions: buildQuestionTemplate(current.type) }))
                          }
                        >
                          Reset questions
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{form.questions.length} total questions</Badge>
                  <Badge variant="outline">
                    {questionGroups.A.length} in Part A
                    {form.type === "LISTENING" ? " ┬╖ 2 extracts ┬╖ 12 per extract" : ""}
                  </Badge>
                  <Badge variant="outline">
                    {questionGroups.B.length} in Part B
                    {form.type === "LISTENING"
                      ? " ┬╖ 6 extracts ┬╖ 1 MCQ each"
                      : form.type === "READING"
                        ? " ┬╖ 6 extracts ┬╖ 1 MCQ each"
                        : ""}
                  </Badge>
                  <Badge variant="outline">
                    {questionGroups.C.length} in Part C
                    {form.type === "READING"
                      ? " ┬╖ 2 extracts ┬╖ 8 per extract"
                      : form.type === "LISTENING"
                        ? " ┬╖ 2 extracts ┬╖ 6 per extract"
                        : ""}
                  </Badge>
                </div>

                <Tabs defaultValue="A" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="A">
                      Part A
                    </TabsTrigger>
                    <TabsTrigger value="B">
                      Part B
                    </TabsTrigger>
                    <TabsTrigger value="C">
                      Part C
                    </TabsTrigger>
                  </TabsList>

                  {(["A", "B", "C"] as const).map((key) => (
                    <TabsContent key={key} value={key} forceMount className="mt-0 space-y-4 data-[state=inactive]:hidden">
                      {renderPartSubInstructions(key)}
                      {renderPartBookletEditor(key)}
                      {key === "A" && form.type === "LISTENING" ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">24 questions</Badge>
                            <Badge variant="secondary">2 extracts</Badge>
                            <Badge variant="secondary">12 fill-in-the-blank per extract</Badge>
                          </div>
                          <Tabs defaultValue={listeningPartAExtractGroups[0]?.id ?? "extract-1"} className="space-y-4">
                            <TabsList className="grid w-full grid-cols-2">
                              {listeningPartAExtractGroups.map((group) => (
                                <TabsTrigger key={group.id} value={group.id}>
                                  {group.label}
                                  <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                                    ({group.questionRange})
                                  </span>
                                </TabsTrigger>
                              ))}
                            </TabsList>
                            {listeningPartAExtractGroups.map((group, index) => (
                              <TabsContent
                                key={group.id}
                                value={group.id}
                                forceMount
                                className="mt-0 space-y-4 data-[state=inactive]:hidden"
                              >
                                <p className="text-xs text-muted-foreground">
                                  Fill in the blanks · {group.questions.length} questions · {group.questionRange}
                                </p>
                                {renderListeningPartAExtractQuestionHeading(
                                  group.id,
                                  index + 1,
                                  group.questionRange
                                )}
                                {renderListeningPartAQuestionHeadingGroups(
                                  group.id,
                                  index + 1,
                                  group.questionRange
                                )}
                                <Accordion type="multiple" className="space-y-3">
                                  {group.questions.map((question) => renderQuestionEditor(question))}
                                </Accordion>
                              </TabsContent>
                            ))}
                          </Tabs>
                        </div>
                      ) : key === "B" && form.type === "LISTENING" ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">6 questions</Badge>
                            <Badge variant="secondary">6 extracts</Badge>
                            <Badge variant="secondary">3-option MCQ each</Badge>
                          </div>
                          <Tabs
                            defaultValue={listeningPartBExtractGroups[0]?.id ?? "b-extract-1"}
                            className="space-y-4"
                          >
                            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3">
                              {listeningPartBExtractGroups.map((group) => (
                                <TabsTrigger key={group.id} value={group.id} className="text-xs">
                                  {group.label}
                                  <span className="ml-1 text-[10px] text-muted-foreground">({group.questionRange})</span>
                                </TabsTrigger>
                              ))}
                            </TabsList>
                            {listeningPartBExtractGroups.map((group) => (
                              <TabsContent key={group.id} value={group.id} className="mt-0 space-y-4">
                                <p className="text-xs text-muted-foreground">
                                  MCQ with 3 options ┬╖ {group.questionRange}
                                </p>
                                <Accordion type="multiple" className="space-y-3">
                                  {group.questions.map((question) => renderQuestionEditor(question))}
                                </Accordion>
                              </TabsContent>
                            ))}
                          </Tabs>
                        </div>
                      ) : key === "C" && form.type === "LISTENING" ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">12 questions</Badge>
                            <Badge variant="secondary">2 extracts</Badge>
                            <Badge variant="secondary">6 MCQs ┬╖ 3 options each</Badge>
                          </div>
                          <Tabs
                            defaultValue={listeningPartCExtractGroups[0]?.id ?? "c-extract-1"}
                            className="space-y-4"
                          >
                            <TabsList className="grid w-full grid-cols-2">
                              {listeningPartCExtractGroups.map((group) => (
                                <TabsTrigger key={group.id} value={group.id}>
                                  {group.label}
                                  <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                                    ({group.questionRange})
                                  </span>
                                </TabsTrigger>
                              ))}
                            </TabsList>
                            {listeningPartCExtractGroups.map((group, index) => (
                              <TabsContent
                                key={group.id}
                                value={group.id}
                                forceMount
                                className="mt-0 space-y-4 data-[state=inactive]:hidden"
                              >
                                <p className="text-xs text-muted-foreground">
                                  MCQs with 3 options · {group.questions.length} questions · {group.questionRange}
                                </p>
                                {renderListeningExtractQuestionHeading(
                                  group.id,
                                  index + 1,
                                  group.questionRange
                                )}
                                <Accordion type="multiple" className="space-y-3">
                                  {group.questions.map((question) => renderQuestionEditor(question))}
                                </Accordion>
                              </TabsContent>
                            ))}
                          </Tabs>
                        </div>
                      ) : key === "B" && form.type === "READING" ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">6 questions</Badge>
                            <Badge variant="secondary">6 extracts</Badge>
                            <Badge variant="secondary">3-option MCQ each</Badge>
                          </div>
                          <Tabs
                            defaultValue={readingPartBExtractGroups[0]?.id ?? "reading-b-1"}
                            className="space-y-4"
                          >
                            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3">
                              {readingPartBExtractGroups.map((group) => (
                                <TabsTrigger key={group.id} value={group.id} className="text-xs">
                                  {group.label}
                                  <span className="ml-1 text-[10px] text-muted-foreground">({group.questionRange})</span>
                                </TabsTrigger>
                              ))}
                            </TabsList>
                            {readingPartBExtractGroups.map((group, index) => (
                              <TabsContent
                                key={group.id}
                                value={group.id}
                                forceMount
                                className="mt-0 space-y-4 data-[state=inactive]:hidden"
                              >
                                <p className="text-xs text-muted-foreground">
                                  One booklet and one MCQ ┬╖ {group.questionRange}
                                </p>
                                {renderReadingPartBExtractBooklet(
                                  resolveReadingPartBExtractId(group.id, index),
                                  group.questions[0]?.sequence ?? 21 + index,
                                  index + 1
                                )}
                                <Accordion type="multiple" className="space-y-3">
                                  {group.questions.map((question) => renderQuestionEditor(question))}
                                </Accordion>
                              </TabsContent>
                            ))}
                          </Tabs>
                        </div>
                      ) : key === "C" && form.type === "READING" ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">16 questions</Badge>
                            <Badge variant="secondary">2 extracts</Badge>
                            <Badge variant="secondary">8 questions per extract</Badge>
                          </div>
                          <Tabs
                            defaultValue={readingPartCExtractGroups[0]?.id ?? "reading-c-1"}
                            className="space-y-4"
                          >
                            <TabsList className="grid w-full grid-cols-2">
                              {readingPartCExtractGroups.map((group) => (
                                <TabsTrigger key={group.id} value={group.id}>
                                  {group.label}
                                  <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                                    ({group.questionRange})
                                  </span>
                                </TabsTrigger>
                              ))}
                            </TabsList>
                            {readingPartCExtractGroups.map((group, index) => (
                              <TabsContent
                                key={group.id}
                                value={group.id}
                                forceMount
                                className="mt-0 space-y-4 data-[state=inactive]:hidden"
                              >
                                <p className="text-xs text-muted-foreground">
                                  One booklet and eight MCQs · {group.questionRange}
                                </p>
                                {renderReadingPartCExtractBooklet(
                                  resolveReadingPartCExtractId(group.id, index),
                                  group.questionRange,
                                  index + 1
                                )}
                                <Accordion type="multiple" className="space-y-3">
                                  {group.questions.map((question) => renderQuestionEditor(question))}
                                </Accordion>
                              </TabsContent>
                            ))}
                          </Tabs>
                        </div>
                      ) : (
                        <Accordion type="multiple" className="space-y-3">
                          {questionGroups[key].map((question) => renderQuestionEditor(question))}
                        </Accordion>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
            </div>
          </CardContent>
        </Card>
      </section>

      {form.type === "LISTENING" ? (
        <Dialog open={listeningPreviewOpen} onOpenChange={setListeningPreviewOpen}>
          <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
            <DialogHeader className="shrink-0 space-y-2 border-b border-border/60 px-6 py-4 text-left">
              <DialogTitle>Candidate preview — listening test</DialogTitle>
              <DialogDescription>
                Questions are paginated as candidates see them: Q1–12, Q13–24, Q25–30, Q31–36, then Q37–46.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <ListeningCandidatePreview
                title={form.title || "Untitled listening test"}
                instructions={form.instructions}
                partASubInstructions={form.partASubInstructions}
                partBSubInstructions={form.partBSubInstructions}
                partCSubInstructions={form.partCSubInstructions}
                questions={form.questions}
                partAExtractQuestionHeadings={form.partAExtractQuestionHeadings}
                partAQuestionHeadingGroups={form.partAQuestionHeadingGroups}
                partCExtractQuestionHeadings={form.partCExtractQuestionHeadings}
              />
            </div>
            <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-3 sm:justify-end">
              <Button type="button" onClick={() => setListeningPreviewOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {saving ? (
        <RouteLoadingScreen
          title="Saving test"
          subtitle="Writing questions, headings, and settings"
          progressLabel="test.save"
          progressValueLabel="in progress"
          footerText="Please wait · do not close this page"
        />
      ) : null}
    </AdminShell>
  );
}
