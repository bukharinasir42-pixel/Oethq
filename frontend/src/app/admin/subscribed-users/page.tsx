"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Mail, Search, Settings2, UserPlus, X } from "lucide-react";
import { InlineLoader } from "@/components/loaders";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { ManageAccessDialog } from "@/components/admin/manage-access-dialog";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { PROFESSIONS } from "@/lib/profile-options";
import { apiFetch } from "@/lib/api";
import { sendActivationEmail } from "@/lib/emailjs";
import type { CreatedCustomUserDto, PlanDto, SubscribedUserDto } from "@/lib/types";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";

const EMPTY_PLAN = "__select_plan__";

const NO_PLAN = "__no_plan__";

const NO_PROFESSION = "__no_profession__";

type CustomUserFormValues = {
  name: string;
  email: string;
  /** "" / NO_PLAN = no Complete Course; the candidate gets individual packages only. */
  planId: string;
  /** The candidate's profession. Blank is fine — they can pick it in the portal. */
  profession: string;
  /** Slugs of the individual (standalone) packages to grant. */
  productSlugs: string[];
  /** Optional override for how long those packages last; blank = each product's own duration. */
  productDays: string;
  temporaryPassword: string;
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : "N/A";
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="surface-panel-subtle rounded-xl px-4 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">{value}</p>
    </div>
  );
}

export default function SubscribedUsersPage() {
  const { token, profile, status, error, logout, refresh } = useSession();
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [standaloneProducts, setStandaloneProducts] = useState<CatalogueProduct[]>([]);
  const [subscribedUsers, setSubscribedUsers] = useState<SubscribedUserDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mailingUserId, setMailingUserId] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<CreatedCustomUserDto | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  // The candidate whose access is being upgraded / downgraded.
  const [managing, setManaging] = useState<SubscribedUserDto | null>(null);
  // Table filters. Kept in state rather than the URL: this is a working view an
  // admin re-filters constantly, not something they link to or bookmark.
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const form = useForm<CustomUserFormValues>({
    defaultValues: {
      name: "",
      email: "",
      profession: "",
      planId: "",
      productSlugs: [],
      productDays: "",
      temporaryPassword: ""
    }
  });

  const loadData = useCallback(async () => {
    if (!token) return;
    const [planResponse, subscribedResponse, catalogue] = await Promise.all([
      apiFetch<PlanDto[]>("/plans", { token }),
      apiFetch<SubscribedUserDto[]>("/users/subscribed", { token }),
      productsApi.list()
    ]);
    setPlans(planResponse);
    setSubscribedUsers(subscribedResponse);
    setStandaloneProducts(catalogue.products.filter((p) => p.category === "STANDALONE" && p.isPurchasable !== false));
  }, [token]);

  useEffect(() => {
    const load = async () => {
      if (!token || !profile || profile.role !== "ADMIN") return;
      try {
        await loadData();
      } catch (caughtError: unknown) {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load subscribed users");
      }
    };

    void load();
  }, [loadData, profile, token]);

  const activeUsers = useMemo(
    () => subscribedUsers.filter((user) => user.status === "ACTIVE" || user.status === "TRIAL").length,
    [subscribedUsers]
  );
  const bandReadyUsers = useMemo(
    () => subscribedUsers.filter((user) => Boolean(user.currentBand)).length,
    [subscribedUsers]
  );

  /** Every plan and course actually present, so the dropdowns never offer a dead option. */
  const planOptions = useMemo(
    () => [...new Set(subscribedUsers.map((u) => u.plan.name))].sort((a, b) => a.localeCompare(b)),
    [subscribedUsers]
  );
  const courseOptions = useMemo(
    () => [...new Set(subscribedUsers.flatMap((u) => (u.courses ?? []).map((c) => c.name)))].sort((a, b) => a.localeCompare(b)),
    [subscribedUsers]
  );

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subscribedUsers.filter((u) => {
      // Name, email, plan and course names all match — an admin searching
      // "nursing" or "elite" means the same thing as searching a person.
      if (q) {
        const haystack = [u.name, u.email, u.plan.name, ...(u.courses ?? []).map((c) => c.name)]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (planFilter !== "ALL" && u.plan.name !== planFilter) return false;
      if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
      if (courseFilter === "NONE" && (u.courses?.length ?? 0) > 0) return false;
      if (courseFilter !== "ALL" && courseFilter !== "NONE") {
        if (!(u.courses ?? []).some((c) => c.name === courseFilter)) return false;
      }
      return true;
    });
  }, [subscribedUsers, query, planFilter, statusFilter, courseFilter]);

  const filtersOn = query.trim() !== "" || planFilter !== "ALL" || statusFilter !== "ALL" || courseFilter !== "ALL";
  const clearFilters = () => {
    setQuery("");
    setPlanFilter("ALL");
    setStatusFilter("ALL");
    setCourseFilter("ALL");
  };

  const openCreateModal = () => {
    setCreatedUser(null);
    form.reset({
      name: "",
      email: "",
      planId: "",
      productSlugs: [],
      productDays: "",
      temporaryPassword: ""
    });
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreatedUser(null);
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading subscribed users..." layout="table" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to manage subscribed users."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const createCustomUser = async (values: CustomUserFormValues) => {
    const hasPlan = Boolean(values.planId) && values.planId !== NO_PLAN;
    if (!hasPlan && values.productSlugs.length === 0) {
      toast.error("Select the Complete Material plan, one or more individual packages, or both.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiFetch<CreatedCustomUserDto>("/users/custom", {
        method: "POST",
        token,
        body: {
          name: values.name,
          email: values.email,
          // Optional. Left blank, the student picks it in their portal.
          profession: values.profession || undefined,
          // Either may be omitted, but not both — the API rejects an empty grant.
          planId: values.planId && values.planId !== NO_PLAN ? values.planId : undefined,
          productSlugs: values.productSlugs.length ? values.productSlugs : undefined,
          productDays: values.productDays.trim() ? Number(values.productDays) : undefined,
          temporaryPassword: values.temporaryPassword || undefined
        }
      });
      setCreatedUser(response);
      if (response.activationEmail?.otp) {
        const emailResult = await sendActivationEmail({
          toName: response.activationEmail.toName,
          toEmail: response.activationEmail.toEmail,
          planName: response.activationEmail.planName,
          otp: response.activationEmail.otp,
          activationUrl: response.activationEmail.activationUrl,
          orderId: response.activationEmail.purchaseId
        });
        if (!emailResult.success) {
          toast.error(emailResult.error || "User created, but activation email failed to send.");
        }
      }
      form.reset({
        name: "",
        email: "",
        planId: "",
        productSlugs: [],
        productDays: "",
        temporaryPassword: ""
      });
      await loadData();
      const pkgCount = response.grantedPackages?.length ?? 0;
      toast.success(
        response.activationEmail
          ? `Candidate created${pkgCount ? ` with ${pkgCount} package${pkgCount === 1 ? "" : "s"}` : ""} — activation email sent`
          : `Candidate created with ${pkgCount} package${pkgCount === 1 ? "" : "s"} — access is live, no activation needed`
      );
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to create custom user");
    } finally {
      setSubmitting(false);
    }
  };

  const sendPurchaseEmail = async (userId: string, planId: string) => {
    setMailingUserId(userId);
    try {
      const response = await apiFetch<{
        activationUrl: string;
        otp?: string;
        activationEmail?: {
          toName: string;
          toEmail: string;
          planName: string;
          otp: string;
          activationUrl: string;
          purchaseId: string;
        };
      }>("/subscriptions/purchase-email", {
        method: "POST",
        token,
        body: {
          userId,
          planId,
          provider: "manual-admin"
        }
      });
      if (response.activationEmail?.otp) {
        const emailResult = await sendActivationEmail({
          toName: response.activationEmail.toName,
          toEmail: response.activationEmail.toEmail,
          planName: response.activationEmail.planName,
          otp: response.activationEmail.otp,
          activationUrl: response.activationEmail.activationUrl,
          orderId: response.activationEmail.purchaseId
        });
        if (!emailResult.success) {
          toast.error(emailResult.error || "Activation email failed to send.");
          return;
        }
      }
      toast.success(`Activation email sent${response.otp ? ` (OTP: ${response.otp})` : ""}`);
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to send purchase email");
    } finally {
      setMailingUserId(null);
    }
  };

  return (
    <AdminShell
      title="Subscribed Users"
      description="Assign plans to new candidates, trigger purchase-style activation emails, and jump into progress review."
      profile={profile}
      onRefresh={refresh}
      onLogout={logout}
    >
      {loadError ? <WorkspaceErrorAlert title="Unable to load subscribed users" description={loadError} /> : null}

      <Card className="border-border shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-col gap-4 border-b border-border/50 p-5 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-lg">Subscribed Candidates</CardTitle>
            <CardDescription>
              Manage enrolled candidates, review plan status, and trigger activation or progress review.
            </CardDescription>
          </div>
          <Button type="button" className="shrink-0 cursor-pointer" onClick={openCreateModal}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create Candidate Access
          </Button>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Candidates" value={subscribedUsers.length} />
            <StatTile label="Active" value={activeUsers} />
            <StatTile label="Band-ready" value={bandReadyUsers} />
            <StatTile label="Plans" value={plans.length} />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Search name, email, plan or course"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[150px] text-sm"><SelectValue placeholder="Plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All plans</SelectItem>
                {planOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[150px] text-sm"><SelectValue placeholder="Course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All courses</SelectItem>
                <SelectItem value="NONE">No individual course</SelectItem>
                {courseOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[130px] text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
              </SelectContent>
            </Select>

            {filtersOn ? (
              <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}

            <span className="ml-auto text-xs text-muted-foreground">
              {filtersOn ? `${visibleUsers.length} of ${subscribedUsers.length}` : `${subscribedUsers.length}`} candidates
            </span>
          </div>

          {subscribedUsers.length === 0 ? (
            <EmptyState
              title="No subscribed candidates yet"
              description="Create the first custom user or complete a purchase flow to populate this table."
            >
              <Button type="button" className="mt-2 cursor-pointer" onClick={openCreateModal}>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Candidate Access
              </Button>
            </EmptyState>
          ) : visibleUsers.length === 0 ? (
            <EmptyState
              title="No candidates match"
              description="Nothing matches these filters. Clear them to see every candidate again."
            >
              <Button type="button" variant="outline" className="mt-2 cursor-pointer" onClick={clearFilters}>
                Clear filters
              </Button>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Courses</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current band</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUsers.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{user.plan.name}</TableCell>
                      <TableCell>
                        {user.courses && user.courses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.courses.map((c) => (
                              <Badge key={c.entitlementKey} variant="secondary" className="text-[10px]">
                                {c.name.replace(/^OET /, "")}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.plan.tier}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "ACTIVE" ? "default" : "outline"}>{user.status}</Badge>
                      </TableCell>
                      <TableCell>{user.currentBand || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(user.startDate)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(user.endDate)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button asChild variant="outline" size="sm" className="cursor-pointer">
                            <Link href={`/admin/progress?userId=${encodeURIComponent(user.userId)}`}>Progress</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => setManaging(user)}
                          >
                            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                            Manage
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => void sendPurchaseEmail(user.userId, user.plan.id)}
                            disabled={mailingUserId === user.userId}
                          >
                            <Mail className="mr-1.5 h-3.5 w-3.5" />
                            {mailingUserId === user.userId ? "Sending..." : "Email"}
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

      <ManageAccessDialog
        user={managing}
        plans={plans}
        products={standaloneProducts}
        open={managing !== null}
        onOpenChange={(o) => { if (!o) setManaging(null); }}
        onChanged={() => void loadData()}
      />

      <Dialog
        open={createModalOpen}
        onOpenChange={(open) => {
          if (!open) closeCreateModal();
          else setCreateModalOpen(true);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Candidate Access</DialogTitle>
            <DialogDescription>
              Create the account, assign the plan, and send the first activation flow from one form.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => void createCustomUser(values))}>
              <FormField
                control={form.control}
                name="name"
                rules={{ required: "Candidate name is required." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Candidate name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                rules={{
                  required: "Email is required.",
                  pattern: {
                    value: /\S+@\S+\.\S+/,
                    message: "Enter a valid email address."
                  }
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="profession"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profession <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                    <Select
                      value={field.value || NO_PROFESSION}
                      onValueChange={(v) => field.onChange(v === NO_PROFESSION ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select profession" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PROFESSION}>Let the student choose</SelectItem>
                        {PROFESSIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Decides which writing case notes and Speaking sheets they see. Leave it and they pick
                      it themselves on first use.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="planId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complete Material plan <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                    <Select
                      value={field.value || EMPTY_PLAN}
                      onValueChange={(value) => field.onChange(value === EMPTY_PLAN ? "" : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={EMPTY_PLAN}>No Complete Material plan</SelectItem>
                        {plans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Plans define tier, duration, and quota limits.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Individual (standalone) packages — a candidate can get these
                  instead of, or alongside, the Complete Material plan. */}
              <FormField
                control={form.control}
                name="productSlugs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Individual packages <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-xl border border-border/70 p-2.5 sm:grid-cols-2">
                      {standaloneProducts.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-muted-foreground">No individual packages available.</p>
                      ) : (
                        standaloneProducts.map((p) => {
                          const checked = field.value.includes(p.slug);
                          return (
                            <label
                              key={p.slug}
                              className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.checked
                                      ? [...field.value, p.slug]
                                      : field.value.filter((s: string) => s !== p.slug)
                                  )
                                }
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium text-foreground">{p.name}</span>
                                <span className="block text-[10px] text-muted-foreground">
                                  {p.slug}
                                  {p.durationDays ? ` · ${p.durationDays} days` : ""}
                                </span>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    <FormDescription>
                      Granted immediately — no activation OTP needed. Leave the plan empty to create a
                      single-skill-only candidate.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="productDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Package access days <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="Leave blank for each package's own duration" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="temporaryPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temporary password</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Optional. Leave blank to auto-generate." />
                    </FormControl>
                    <FormDescription>This can be omitted if you want the system to generate one.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {createdUser ? (
                <Alert>
                  <AlertTitle>Candidate created</AlertTitle>
                  <AlertDescription className="space-y-1">
                    <p>{createdUser.user.email}</p>
                    <p>Activation URL: {createdUser.activationUrl}</p>
                    {createdUser.temporaryPassword ? <p>Temporary password: {createdUser.temporaryPassword}</p> : null}
                    {createdUser.otp ? <p>OTP: {createdUser.otp}</p> : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="cursor-pointer" onClick={closeCreateModal}>
                  {createdUser ? "Close" : "Cancel"}
                </Button>
                {!createdUser ? (
                  <Button className="cursor-pointer" type="submit" disabled={submitting}>
                    <span className="inline-flex items-center justify-center gap-2">
                      {submitting ? (
                        <InlineLoader label="Creating user" size="sm" />
                      ) : (
                        <UserPlus className="h-4 w-4" aria-hidden />
                      )}
                      {!submitting ? "Create custom user" : null}
                    </span>
                  </Button>
                ) : null}
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
