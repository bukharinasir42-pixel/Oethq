"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, EyeOff, ImagePlus, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { InlineLoader } from "@/components/loaders";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { ExternalImage } from "@/components/external-image";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { isHtmlEmpty } from "@/lib/html";
import { apiFetch, apiUpload } from "@/lib/api";
import type { AdminBlogDto, BlogType, StorageAssetDto } from "@/lib/types";
import { cn } from "@/lib/utils";

const BLOG_TYPES: BlogType[] = ["READING", "SPEAKING", "WRITING", "LISTENING"];

const TYPE_LABEL: Record<BlogType, string> = {
  READING: "Reading",
  SPEAKING: "Speaking",
  WRITING: "Writing",
  LISTENING: "Listening"
};

type FormState = {
  id?: string;
  title: string;
  description: string;
  content: string;
  blogType: BlogType;
  imageAssetId: string | null;
  imageUrl: string | null;
};

function emptyForm(): FormState {
  return {
    title: "",
    description: "",
    content: "",
    blogType: "READING",
    imageAssetId: null,
    imageUrl: null
  };
}

function openPublicBlogPreview(blogId: string) {
  if (typeof window === "undefined") return;
  const url = `${window.location.origin}/blogs/p/${encodeURIComponent(blogId)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function blogTypeBadgeClass(type: BlogType) {
  switch (type) {
    case "READING":
      return "border-blue-100 bg-blue-50 text-blue-700";
    case "SPEAKING":
      return "border-green-100 bg-green-50 text-green-700";
    case "WRITING":
      return "border-pink-100 bg-pink-50 text-pink-700";
    case "LISTENING":
      return "border-violet-100 bg-violet-50 text-violet-800";
    default:
      return "";
  }
}

export default function AdminBlogsPage() {
  const { token, profile, status, error, logout, refresh } = useSession();
  const [blogs, setBlogs] = useState<AdminBlogDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const editingBlog = form.id ? blogs.find((b) => b.id === form.id) : undefined;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  /** Revoke blob: URLs from URL.createObjectURL when clearing or replacing preview */
  const blobPreviewRef = useRef<string | null>(null);

  const revokeBlobPreview = () => {
    if (blobPreviewRef.current) {
      URL.revokeObjectURL(blobPreviewRef.current);
      blobPreviewRef.current = null;
    }
  };

  useEffect(() => () => revokeBlobPreview(), []);

  /** When API omits imageUrl (e.g. signing hiccup), load a presigned GET URL for preview. */
  useEffect(() => {
    if (!token || !form.imageAssetId || form.imageUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const asset = await apiFetch<StorageAssetDto & { signedUrl?: string }>(
          `/storage/${form.imageAssetId}/signed-url`,
          { token }
        );
        const url = asset?.signedUrl ?? null;
        if (!cancelled && url) setForm((f) => (f.imageAssetId === form.imageAssetId ? { ...f, imageUrl: url } : f));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, form.imageAssetId, form.imageUrl]);

  const loadBlogs = useCallback(async () => {
    if (!token) return;
    const rows = await apiFetch<AdminBlogDto[]>("/blogs/admin", { token });
    const enriched = await Promise.all(
      rows.map(async (blog) => {
        if (!blog.imageAssetId || blog.imageUrl) return blog;
        try {
          const asset = await apiFetch<StorageAssetDto & { signedUrl?: string }>(
            `/storage/${blog.imageAssetId}/signed-url`,
            { token }
          );
          const url = asset?.signedUrl ?? null;
          return url ? { ...blog, imageUrl: url } : blog;
        } catch {
          return blog;
        }
      })
    );
    setBlogs(enriched);
  }, [token]);

  useEffect(() => {
    const load = async () => {
      if (!token || !profile || profile.role !== "ADMIN") return;
      try {
        await loadBlogs();
      } catch (caughtError: unknown) {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load blogs");
      }
    };
    void load();
  }, [loadBlogs, profile, token]);

  const hydrateFromBlog = (blog: AdminBlogDto) => {
    revokeBlobPreview();
    setForm({
      id: blog.id,
      title: blog.title,
      description: blog.description,
      content: blog.content ?? "",
      blogType: blog.blogType,
      imageAssetId: blog.imageAssetId,
      imageUrl: blog.imageUrl
    });
  };

  const handleImage = async (file: File | null) => {
    if (!file || !token) return;
    revokeBlobPreview();
    const blobUrl = URL.createObjectURL(file);
    blobPreviewRef.current = blobUrl;
    setForm((f) => ({ ...f, imageUrl: blobUrl }));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      const asset = await apiUpload<StorageAssetDto>(`/storage/upload/IMAGE`, formData, { token });
      revokeBlobPreview();
      setForm((f) => ({
        ...f,
        imageAssetId: asset.id,
        imageUrl: asset.signedUrl ?? null
      }));
      toast.success("Image uploaded");
    } catch (caughtError: unknown) {
      revokeBlobPreview();
      setForm((f) => ({ ...f, imageUrl: null }));
      toast.error(caughtError instanceof Error ? caughtError.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!token) return;
    if (!form.title.trim() || isHtmlEmpty(form.description)) {
      toast.error("Title and description are required");
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await apiFetch(`/blogs/${form.id}`, {
          method: "PATCH",
          token,
          body: {
            title: form.title.trim(),
            description: form.description.trim() || "",
            content: isHtmlEmpty(form.content) ? null : form.content.trim(),
            blogType: form.blogType,
            imageAssetId: form.imageAssetId === null ? null : form.imageAssetId
          }
        });
        toast.success("Blog updated");
      } else {
        await apiFetch(`/blogs`, {
          method: "POST",
          token,
          body: {
            title: form.title.trim(),
            description: form.description.trim() || "",
            content: isHtmlEmpty(form.content) ? undefined : form.content.trim(),
            blogType: form.blogType,
            imageAssetId: form.imageAssetId ?? undefined
          }
        });
        toast.success("Blog created");
      }
      revokeBlobPreview();
      setForm(emptyForm());
      await loadBlogs();
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (blog: AdminBlogDto) => {
    if (!token) return;
    const publish = blog.status !== "PUBLISHED";
    try {
      await apiFetch(`/blogs/${blog.id}/publish`, {
        method: "PUT",
        token,
        body: { publish }
      });
      toast.success(publish ? "Published" : "Moved to draft");
      await loadBlogs();
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Update failed");
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/blogs/${id}`, { method: "DELETE", token });
      toast.success("Blog deleted");
      setDeleteId(null);
      if (form.id === id) {
        revokeBlobPreview();
        setForm(emptyForm());
      }
      await loadBlogs();
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Delete failed");
    }
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading blogs..." layout="editor" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to manage blog posts."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <>
      <AdminShell
        title="Blog posts"
        description="Create and publish OET articles with cover images, descriptions, and category types."
        profile={profile}
        fillContent
        onRefresh={() => void loadBlogs()}
        onLogout={logout}
      >
        {loadError ? <WorkspaceErrorAlert description={loadError} /> : null}

        <div className="flex w-full flex-col gap-6 lg:gap-8">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Newspaper className="h-5 w-5" aria-hidden />
                  All posts
                </CardTitle>
                <CardDescription>Draft and published posts; only published items appear on the public API.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  revokeBlobPreview();
                  setForm(emptyForm());
                }}
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                New
              </Button>
            </CardHeader>
            <CardContent>
              {blogs.length === 0 ? (
                <EmptyState title="No blog posts yet" description="Use the editor to create your first post." />
              ) : (
                <div className="w-full rounded-md border">
                  <Table className="w-full table-fixed [&_th]:align-middle [&_td]:align-middle">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 shrink-0 px-2 text-center">Cover</TableHead>
                        <TableHead className="min-w-0">Title</TableHead>
                        <TableHead className="w-[14%]">Type</TableHead>
                        <TableHead className="w-[14%]">Status</TableHead>
                        <TableHead className="w-[15%] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blogs.map((blog) => (
                        <TableRow key={blog.id}>
                          <TableCell className="w-16 shrink-0 px-2 align-middle">
                            {blog.imageUrl ? (
                              <div className="relative mx-auto h-12 w-12 overflow-hidden rounded-md border bg-muted">
                                <ExternalImage
                                  src={blog.imageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div
                                className="mx-auto h-12 w-12 rounded-md border border-dashed border-muted-foreground/25 bg-muted/50"
                                aria-hidden
                              />
                            )}
                          </TableCell>
                          <TableCell className="min-w-0 font-medium">
                            <span className="line-clamp-2 break-words">{blog.title}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(blogTypeBadgeClass(blog.blogType))}>
                              {TYPE_LABEL[blog.blogType]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={blog.status === "PUBLISHED" ? "default" : "secondary"}>
                              {blog.status === "PUBLISHED" ? "Published" : "Draft"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button type="button" variant="ghost" size="icon" onClick={() => hydrateFromBlog(blog)} title="Edit">
                                <Pencil className="h-4 w-4" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={blog.status !== "PUBLISHED"}
                                title={
                                  blog.status === "PUBLISHED"
                                    ? "Open public article preview (new tab)"
                                    : "Publish the post to preview it on the public site"
                                }
                                aria-label="Open public article preview in a new tab"
                                onClick={() => openPublicBlogPreview(blog.id)}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => void togglePublish(blog)}
                                title={blog.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                              >
                                {blog.status === "PUBLISHED" ? (
                                  <EyeOff className="h-4 w-4" aria-hidden />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                                )}
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteId(blog.id)} title="Delete">
                                <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-lg">{form.id ? "Edit post" : "New post"}</CardTitle>
              <CardDescription>Title, short description, optional body, category, and cover image.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="blog-title">Title</Label>
                <Input
                  id="blog-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="OET Reading: 5 Essential Tips"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-desc">Description</Label>
                <p className="text-xs text-muted-foreground">Shown on cards and listings. Supports basic formatting.</p>
                <RichTextEditor
                  id="blog-desc"
                  minHeight="sm"
                  value={form.description}
                  onChange={(html) => setForm((f) => ({ ...f, description: html }))}
                  placeholder="Short summary for cards and listings…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-content">Full content (optional)</Label>
                <RichTextEditor
                  id="blog-content"
                  minHeight="lg"
                  value={form.content}
                  onChange={(html) => setForm((f) => ({ ...f, content: html }))}
                  placeholder="Long-form article body…"
                />
              </div>
              <div className="space-y-2">
                <Label>Blog type</Label>
                <Select
                  value={form.blogType}
                  onValueChange={(v) => setForm((f) => ({ ...f, blogType: v as BlogType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOG_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-image">Cover image</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="blog-image"
                    type="file"
                    accept="image/*"
                    className="cursor-pointer"
                    disabled={uploading}
                    onChange={(e) => void handleImage(e.target.files?.[0] ?? null)}
                  />
                  {uploading ? <InlineLoader label="Uploading image" className="text-muted-foreground" size="sm" /> : null}
                </div>
                {form.imageAssetId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      Image attached ({form.imageAssetId.slice(0, 8)}…). Upload again to replace.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        revokeBlobPreview();
                        setForm((f) => ({ ...f, imageAssetId: null, imageUrl: null }));
                      }}
                    >
                      Remove image
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Uploads use admin storage (IMAGE).</p>
                )}
                {form.imageUrl ? (
                  <div className="overflow-hidden rounded-md border bg-muted/30">
                    <ExternalImage
                      src={form.imageUrl}
                      alt=""
                      className="max-h-56 w-full object-contain sm:max-h-72"
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" onClick={() => void save()} disabled={saving}>
                  <span className="inline-flex items-center justify-center gap-2">
                    {saving ? (
                      <InlineLoader label="Saving blog" size="sm" />
                    ) : (
                      <>
                        <ImagePlus className="h-4 w-4" aria-hidden />
                        {form.id ? "Save changes" : "Create draft"}
                      </>
                    )}
                  </span>
                </Button>
                {form.id ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={editingBlog?.status !== "PUBLISHED"}
                    title={
                      editingBlog?.status === "PUBLISHED"
                        ? "Open public article preview (new tab)"
                        : "Publish the post to preview it on the public site"
                    }
                    onClick={() => openPublicBlogPreview(form.id!)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                    Public preview
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminShell>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && void remove(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
