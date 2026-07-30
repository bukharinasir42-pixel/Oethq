"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Mail, UserPlus } from "lucide-react";
import { InlineLoader } from "@/components/loaders";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
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
import { apiFetch } from "@/lib/api";
import { sendActivationEmail } from "@/lib/emailjs";
import type { CreatedCustomUserDto, PlanDto, SubscribedUserDto } from "@/lib/types";

const EMPTY_PLAN = "__select_plan__";

type CustomUserFormValues = {
  name: string;
  email: string;
  planId: string;
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
  const [subscribedUsers, setSubscribedUsers] = useState<SubscribedUserDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mailingUserId, setMailingUserId] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<CreatedCustomUserDto | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const form = useForm<CustomUserFormValues>({
    defaultValues: {
      name: "",
      email: "",
      planId: "",
      temporaryPassword: ""
    }
  });

  const loadData = useCallback(async () => {
    if (!token) return;
    const [planResponse, subscribedResponse] = await Promise.all([
      apiFetch<PlanDto[]>("/plans", { token }),
      apiFetch<SubscribedUserDto[]>("/users/subscribed", { token })
    ]);
    setPlans(planResponse);
    setSubscribedUsers(subscribedResponse);
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

  const openCreateModal = () => {
    setCreatedUser(null);
    form.reset({
      name: "",
      email: "",
      planId: "",
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
    setSubmitting(true);
    try {
      const response = await apiFetch<CreatedCustomUserDto>("/users/custom", {
        method: "POST",
        token,
        body: {
          name: values.name,
          email: values.email,
          planId: values.planId,
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
        temporaryPassword: ""
      });
      await loadData();
      toast.success("Custom user created and activation email sent");
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
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current band</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribedUsers.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{user.plan.name}</TableCell>
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
                name="planId"
                rules={{ required: "A plan must be selected." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan</FormLabel>
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
                        <SelectItem value={EMPTY_PLAN}>Select plan</SelectItem>
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
