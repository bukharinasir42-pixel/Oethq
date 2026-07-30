"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Image as ImageIcon, Save, Trash2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { InlineLoader } from "@/components/loaders";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/hooks/use-session";
import { apiFetch, apiUpload } from "@/lib/api";
import type { HowToIntroductionDto, StorageAssetDto, WebsiteHomeDto } from "@/lib/types";

function getVideoDisplayUrl(asset: StorageAssetDto | null, fallback?: string | null) {
  return asset?.signedUrl || asset?.publicUrl || fallback || null;
}

function getThumbnailDisplayUrl(asset: StorageAssetDto | null, fallback?: string | null) {
  return asset?.signedUrl || asset?.publicUrl || fallback || null;
}

export default function HowToVideosPage() {
  const { token, profile, status, error, refresh, logout } = useSession();
  const [intro, setIntro] = useState<HowToIntroductionDto | null>(null);
  const [title, setTitle] = useState("Introduction (How to use)");
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);
  const [videoAsset, setVideoAsset] = useState<StorageAssetDto | null>(null);
  const [thumbnailAssetId, setThumbnailAssetId] = useState<string | null>(null);
  const [thumbnailAsset, setThumbnailAsset] = useState<StorageAssetDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [homeLoadError, setHomeLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingHome, setSavingHome] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [homeUploadProgress, setHomeUploadProgress] = useState<number | null>(null);
  const [thumbnailUploadProgress, setThumbnailUploadProgress] = useState<number | null>(null);
  const [homeSettings, setHomeSettings] = useState<WebsiteHomeDto | null>(null);
  const [heroVideoAssetId, setHeroVideoAssetId] = useState<string | null>(null);
  const [heroVideoAsset, setHeroVideoAsset] = useState<StorageAssetDto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const homeFileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!token || !profile || profile.role !== "ADMIN") return;
    setLoadError(null);
    setHomeLoadError(null);
    try {
      const [introResponse, homeResponse] = await Promise.all([
        apiFetch<HowToIntroductionDto>("/how-to-introduction/admin", { token }),
        apiFetch<WebsiteHomeDto>("/website/home-video/admin", { token })
      ]);
      setIntro(introResponse);
      setTitle(introResponse.title);
      setVideoAssetId(introResponse.videoAssetId);
      setVideoAsset(introResponse.videoAsset);
      setThumbnailAssetId(introResponse.thumbnailAssetId);
      setThumbnailAsset(introResponse.thumbnailAsset);
      setHomeSettings(homeResponse);
      setHeroVideoAssetId(homeResponse.heroVideoAssetId);
      setHeroVideoAsset(homeResponse.heroVideoAsset);
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to load videos";
      setLoadError(message);
      setHomeLoadError(message);
    }
  }, [token, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewUrl = getVideoDisplayUrl(videoAsset, intro?.videoUrl);
  const thumbnailPreviewUrl = getThumbnailDisplayUrl(thumbnailAsset, intro?.thumbnailUrl);
  const homePreviewUrl = getVideoDisplayUrl(heroVideoAsset, homeSettings?.heroVideoUrl);

  const uploadVideo = async (file: File | null) => {
    if (!file || !token) {
      if (!token) toast.error("Sign in again to upload");
      return;
    }
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("slot", "how-to-video");
      const asset = await apiUpload<StorageAssetDto>(`/storage/upload/VIDEO`, formData, {
        token,
        onProgress: setUploadProgress,
        preferServerUpload: true
      });
      setVideoAssetId(asset.id);
      setVideoAsset(asset);
      toast.success(asset.replaced ? "How-to video replaced" : "How-to video uploaded");
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Video upload failed");
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const uploadThumbnail = async (file: File | null) => {
    if (!file || !token) {
      if (!token) toast.error("Sign in again to upload");
      return;
    }
    setThumbnailUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("slot", "how-to-thumbnail");
      const asset = await apiUpload<StorageAssetDto>(`/storage/upload/IMAGE`, formData, {
        token,
        onProgress: setThumbnailUploadProgress
      });
      setThumbnailAssetId(asset.id);
      setThumbnailAsset(asset);
      toast.success(asset.replaced ? "Thumbnail replaced" : "Thumbnail uploaded");
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Thumbnail upload failed");
    } finally {
      setThumbnailUploadProgress(null);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
    }
  };

  const clearVideo = () => {
    setVideoAssetId(null);
    setVideoAsset(null);
    toast.message("Video cleared — save to persist");
  };

  const clearThumbnail = () => {
    setThumbnailAssetId(null);
    setThumbnailAsset(null);
    toast.message("Thumbnail cleared — save to persist");
  };

  const uploadHomeVideo = async (file: File | null) => {
    if (!file || !token) {
      if (!token) toast.error("Sign in again to upload");
      return;
    }
    setHomeUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("slot", "website-hero-video");
      const asset = await apiUpload<StorageAssetDto>(`/storage/upload/VIDEO`, formData, {
        token,
        onProgress: setHomeUploadProgress,
        preferServerUpload: true
      });
      setHeroVideoAssetId(asset.id);
      setHeroVideoAsset(asset);
      toast.success(asset.replaced ? "Homepage video replaced" : "Homepage video uploaded");
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Homepage video upload failed");
    } finally {
      setHomeUploadProgress(null);
      if (homeFileInputRef.current) homeFileInputRef.current.value = "";
    }
  };

  const clearHomeVideo = () => {
    setHeroVideoAssetId(null);
    setHeroVideoAsset(null);
    toast.message("Homepage video cleared — save to persist");
  };

  const saveHome = async () => {
    if (!token) return;
    setSavingHome(true);
    try {
      const updated = await apiFetch<WebsiteHomeDto>("/website/home-video", {
        method: "PUT",
        token,
        body: { heroVideoAssetId }
      });
      setHomeSettings(updated);
      setHeroVideoAssetId(updated.heroVideoAssetId);
      setHeroVideoAsset(updated.heroVideoAsset);
      toast.success("Homepage video saved");
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Homepage save failed");
    } finally {
      setSavingHome(false);
    }
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await apiFetch<HowToIntroductionDto>("/how-to-introduction", {
        method: "PUT",
        token,
        body: {
          title: title.trim() || "Introduction (How to use)",
          videoAssetId,
          thumbnailAssetId
        }
      });
      setIntro(updated);
      setTitle(updated.title);
      setVideoAssetId(updated.videoAssetId);
      setVideoAsset(updated.videoAsset);
      setThumbnailAssetId(updated.thumbnailAssetId);
      setThumbnailAsset(updated.thumbnailAsset);
      toast.success("How-to video saved");
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading admin workspace..." layout="editor" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Please log in with an admin account to manage how-to videos."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <AdminShell
      title="How to Videos"
      description="Manage the candidate introduction video and the public website homepage hero video."
      profile={profile}
      onRefresh={() => void load()}
      onLogout={logout}
    >
      {loadError ? <WorkspaceErrorAlert title="Unable to load introduction video" description={loadError} /> : null}
      {homeLoadError ? (
        <WorkspaceErrorAlert title="Unable to load homepage video" description={homeLoadError} />
      ) : null}

      <div className="w-full space-y-6">
        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Video className="h-5 w-5 text-primary" aria-hidden />
              Candidate introduction video
            </CardTitle>
            <CardDescription>
              Candidates see this in Task Management under the tab &quot;Introduction (How to use)&quot;. Only one video is
              supported for now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="how-to-title">Tab title</Label>
              <Input
                id="how-to-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Introduction (How to use)"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">Shown as the tab label in the candidate portal.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Video upload */}
              <div className="space-y-3 rounded-xl border border-dashed border-primary/25 bg-primary/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Video className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Video file</p>
                    <p className="text-xs text-muted-foreground">MP4 / WebM recommended.</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(event) => void uploadVideo(event.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer"
                    disabled={uploadProgress !== null}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadProgress !== null ? (
                      <>
                        <InlineLoader className="mr-2 h-4 w-4" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {videoAssetId ? "Replace video" : "Upload video"}
                      </>
                    )}
                  </Button>
                  {videoAssetId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      onClick={clearVideo}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                {uploadProgress !== null ? (
                  <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">Uploading video…</span>
                      <span className="font-medium tabular-nums text-foreground">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {videoAsset
                    ? `${videoAsset.title} · ${(videoAsset.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                    : "No video uploaded yet."}
                </p>
              </div>

              {/* Thumbnail upload */}
              <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ImageIcon className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Video thumbnail (optional)</p>
                    <p className="text-xs text-muted-foreground">Shown before playback. JPG, PNG, or WebP.</p>
                  </div>
                </div>
                {thumbnailPreviewUrl ? (
                  <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailPreviewUrl}
                      alt="Introduction video thumbnail preview"
                      className="aspect-video w-full object-cover"
                    />
                  </div>
                ) : null}
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  className="hidden"
                  onChange={(event) => void uploadThumbnail(event.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer"
                    disabled={thumbnailUploadProgress !== null}
                    onClick={() => thumbnailInputRef.current?.click()}
                  >
                    {thumbnailUploadProgress !== null ? (
                      <>
                        <InlineLoader className="mr-2 h-4 w-4" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {thumbnailAssetId ? "Replace thumbnail" : "Upload thumbnail"}
                      </>
                    )}
                  </Button>
                  {thumbnailAssetId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      onClick={clearThumbnail}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                {thumbnailUploadProgress !== null ? (
                  <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">Uploading thumbnail…</span>
                      <span className="font-medium tabular-nums text-foreground">{thumbnailUploadProgress}%</span>
                    </div>
                    <Progress value={thumbnailUploadProgress} className="h-2" />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {thumbnailAsset ? thumbnailAsset.title : "No thumbnail uploaded yet."}
                  </p>
                )}
              </div>
            </div>

            {previewUrl ? (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="w-full overflow-hidden rounded-[16px] border border-border bg-[#0C2C55] shadow-[var(--shadow-card)]">
                  <video
                    className="oet-video-player aspect-video w-full bg-[linear-gradient(140deg,#134D93_0%,#0C2C55_100%)] object-contain"
                    controls
                    playsInline
                    preload="metadata"
                    poster={thumbnailPreviewUrl || undefined}
                    src={previewUrl}
                  >
                    <track kind="captions" />
                  </video>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end border-t border-border/60 pt-4">
              <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void save()}>
                {saving ? (
                  <>
                    <InlineLoader className="mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card id="homepage-video" className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" aria-hidden />
              Website homepage video
            </CardTitle>
            <CardDescription>
              This video appears on the public marketing homepage hero section, below the main headline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-w-xl space-y-3 rounded-xl border border-dashed border-primary/25 bg-primary/[0.04] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Video className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Homepage hero video</p>
                  <p className="text-xs text-muted-foreground">MP4 / WebM recommended.</p>
                </div>
              </div>
              <input
                ref={homeFileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => void uploadHomeVideo(event.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="cursor-pointer"
                  disabled={homeUploadProgress !== null}
                  onClick={() => homeFileInputRef.current?.click()}
                >
                  {homeUploadProgress !== null ? (
                    <>
                      <InlineLoader className="mr-2 h-4 w-4" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {heroVideoAssetId ? "Replace video" : "Upload video"}
                    </>
                  )}
                </Button>
                {heroVideoAssetId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer text-destructive hover:text-destructive"
                    onClick={clearHomeVideo}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
              {homeUploadProgress !== null ? (
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">Uploading homepage video…</span>
                    <span className="font-medium tabular-nums text-foreground">{homeUploadProgress}%</span>
                  </div>
                  <Progress value={homeUploadProgress} className="h-2" />
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {heroVideoAsset
                  ? `${heroVideoAsset.title} · ${(heroVideoAsset.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                  : "No homepage video uploaded yet."}
              </p>
            </div>

            {homePreviewUrl ? (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="w-full overflow-hidden rounded-[16px] border border-border bg-[#0C2C55] shadow-[var(--shadow-card)]">
                  <video
                    className="oet-video-player aspect-video w-full bg-[linear-gradient(140deg,#134D93_0%,#0C2C55_100%)] object-contain"
                    controls
                    playsInline
                    preload="metadata"
                    src={homePreviewUrl}
                  >
                    <track kind="captions" />
                  </video>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end border-t border-border/60 pt-4">
              <Button type="button" className="cursor-pointer" disabled={savingHome} onClick={() => void saveHome()}>
                {savingHome ? (
                  <>
                    <InlineLoader className="mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save homepage video
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
