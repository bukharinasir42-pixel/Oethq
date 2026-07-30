"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, CreditCard, RotateCcw, XCircle } from "lucide-react";
import { InlineLoader } from "@/components/loaders";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  WorkspaceAccessDeniedState,
  WorkspaceErrorAlert,
  WorkspaceLoadingState
} from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { sendActivationEmail } from "@/lib/emailjs";
import type { AdminPurchaseDto, PlanDto, PurchaseResolutionResponseDto, SubscribedUserDto } from "@/lib/types";

const EMPTY_SELECT = "__empty__";
type HistoryFilter = "ALL" | "TRIAL_UPGRADE" | "DIRECT_PAID" | "COMPLETED" | "PENDING" | "FAILED";

function formatMoney(value: number | string, currency: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return `${currency} ${value}`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function purchaseKind(purchase: AdminPurchaseDto): "TRIAL_UPGRADE" | "DIRECT_PAID" {
  if (purchase.purchaseKind === "TRIAL_UPGRADE" || purchase.upgradedFromTrial) {
    return "TRIAL_UPGRADE";
  }
  return "DIRECT_PAID";
}

export default function AdminPaymentsPage() {
  const { token, profile, status, error, logout, refresh } = useSession();
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [users, setUsers] = useState<SubscribedUserDto[]>([]);
  const [purchases, setPurchases] = useState<AdminPurchaseDto[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("ALL");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyPurchaseId, setBusyPurchaseId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    const [planRows, userRows, purchaseRows] = await Promise.all([
      apiFetch<PlanDto[]>("/plans/admin", { token }),
      apiFetch<SubscribedUserDto[]>("/users/subscribed", { token }),
      apiFetch<AdminPurchaseDto[]>("/subscriptions/purchases", { token })
    ]);
    setPlans(planRows.filter((plan) => plan.tier !== "STARTER"));
    setUsers(userRows);
    setPurchases(purchaseRows);
  }, [token]);

  useEffect(() => {
    const load = async () => {
      if (!token || !profile || profile.role !== "ADMIN") return;
      try {
        await loadData();
      } catch (caughtError: unknown) {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load payments");
      }
    };

    void load();
  }, [loadData, profile, token]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((purchase) => {
      const kind = purchaseKind(purchase);
      if (historyFilter === "TRIAL_UPGRADE") return kind === "TRIAL_UPGRADE";
      if (historyFilter === "DIRECT_PAID") return kind === "DIRECT_PAID";
      if (historyFilter === "COMPLETED" || historyFilter === "PENDING" || historyFilter === "FAILED") {
        return purchase.status === historyFilter;
      }
      return true;
    });
  }, [historyFilter, purchases]);

  const completedCount = useMemo(
    () => purchases.filter((purchase) => purchase.status === "COMPLETED").length,
    [purchases]
  );
  const upgradeCount = useMemo(
    () => purchases.filter((purchase) => purchaseKind(purchase) === "TRIAL_UPGRADE").length,
    [purchases]
  );
  const directCount = useMemo(
    () => purchases.filter((purchase) => purchaseKind(purchase) === "DIRECT_PAID").length,
    [purchases]
  );
  const pendingCount = useMemo(
    () => purchases.filter((purchase) => purchase.status === "PENDING").length,
    [purchases]
  );
  const failedCount = useMemo(
    () => purchases.filter((purchase) => purchase.status === "FAILED").length,
    [purchases]
  );

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading purchase history..." layout="table" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to manage payment history."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const createIntent = async () => {
    if (!selectedUserId || !selectedPlanId) {
      toast.error("Select both a candidate and a plan");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/subscriptions/purchases/mock-intent", {
        method: "POST",
        token,
        body: {
          userId: selectedUserId,
          planId: selectedPlanId,
          provider: "STAGING_MANUAL"
        }
      });
      toast.success("Staging purchase intent created");
      setSelectedUserId("");
      setSelectedPlanId("");
      await loadData();
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to create intent");
    } finally {
      setSubmitting(false);
    }
  };

  const sendWebhook = async (purchaseId: string, statusValue: "COMPLETED" | "FAILED") => {
    setBusyPurchaseId(purchaseId);
    try {
      const response = await apiFetch<PurchaseResolutionResponseDto>("/subscriptions/purchases/mock-webhook", {
        method: "POST",
        token: null,
        body: {
          purchaseId,
          status: statusValue,
          provider: "STAGING_MANUAL",
          eventId: `${statusValue.toLowerCase()}-${purchaseId}`,
          reference: `staging-${purchaseId}`,
          receiptUrl: statusValue === "COMPLETED" ? `https://receipts.staging.local/${purchaseId}` : undefined,
          failureReason: statusValue === "FAILED" ? "Card authorization was declined" : undefined,
          receiptData:
            statusValue === "COMPLETED" ? { provider: "STAGING_MANUAL", processedBy: "admin-console" } : undefined
        }
      });
      if (statusValue === "COMPLETED" && response.activationEmail?.otp) {
        const emailResult = await sendActivationEmail({
          toName: response.activationEmail.toName,
          toEmail: response.activationEmail.toEmail,
          planName: response.activationEmail.planName,
          otp: response.activationEmail.otp,
          activationUrl: response.activationEmail.activationUrl,
          orderId: response.activationEmail.purchaseId
        });
        if (!emailResult.success) {
          toast.error(emailResult.error || "Purchase completed, but activation email failed.");
          return;
        }
      }
      toast.success(
        statusValue === "COMPLETED" ? "Purchase completed and activation sent" : "Purchase marked as failed"
      );
      await loadData();
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Webhook simulation failed");
    } finally {
      setBusyPurchaseId(null);
    }
  };

  const retryPurchase = async (purchaseId: string) => {
    setBusyPurchaseId(purchaseId);
    try {
      await apiFetch(`/subscriptions/purchases/${purchaseId}/retry`, {
        method: "POST",
        token
      });
      toast.success("Purchase moved back to pending");
      await loadData();
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Retry failed");
    } finally {
      setBusyPurchaseId(null);
    }
  };

  return (
    <AdminShell
      title="Payments"
      description="Purchase history for direct paid checkouts and free-trial upgrades, plus staging tools for lifecycle testing."
      profile={profile}
      onRefresh={() => void loadData()}
      onLogout={logout}
    >
      {loadError ? <WorkspaceErrorAlert title="Unable to load payment operations" description={loadError} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="surface-panel-subtle rounded-xl px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">All purchases</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">
            {purchases.length}
          </p>
        </div>
        <div className="surface-panel-subtle rounded-xl px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Completed</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">
            {completedCount}
          </p>
        </div>
        <div className="surface-panel-subtle rounded-xl px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Trial upgrades</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">
            {upgradeCount}
          </p>
        </div>
        <div className="surface-panel-subtle rounded-xl px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Direct paid</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">
            {directCount}
          </p>
        </div>
        <div className="surface-panel-subtle rounded-xl px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pending / failed</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">
            {pendingCount} / {failedCount}
          </p>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" aria-hidden />
              Purchase history
            </CardTitle>
            <CardDescription>
              Every paid checkout is kept here — both first-time paid purchases and upgrades from free trial.
            </CardDescription>
          </div>
          <div className="w-full sm:w-[220px]">
            <Label className="sr-only">Filter history</Label>
            <Select value={historyFilter} onValueChange={(value) => setHistoryFilter(value as HistoryFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All purchases</SelectItem>
                <SelectItem value="TRIAL_UPGRADE">Upgraded from free</SelectItem>
                <SelectItem value="DIRECT_PAID">Direct paid</SelectItem>
                <SelectItem value="COMPLETED">Completed only</SelectItem>
                <SelectItem value="PENDING">Pending only</SelectItem>
                <SelectItem value="FAILED">Failed only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPurchases.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No purchases in this view"
              description="Completed Stripe checkouts and free-trial upgrades will appear here automatically."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.map((purchase) => {
                    const kind = purchaseKind(purchase);
                    return (
                      <TableRow key={purchase.id}>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <p className="font-medium text-foreground">{purchase.user.name}</p>
                            <p className="text-xs text-muted-foreground">{purchase.user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{purchase.plan.name}</Badge>
                        </TableCell>
                        <TableCell>
                          {kind === "TRIAL_UPGRADE" ? (
                            <Badge className="border-transparent bg-sky-600 text-white hover:bg-sky-600">
                              <ArrowUpRight className="mr-1 h-3 w-3 text-white" aria-hidden />
                              Upgraded from free
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Direct paid</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={purchase.status === "COMPLETED" ? "default" : "outline"}>
                            {purchase.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatMoney(purchase.amount, purchase.currency)}
                        </TableCell>
                        <TableCell>{purchase.provider || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(purchase.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(purchase.completedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            {purchase.status === "PENDING" ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => void sendWebhook(purchase.id, "COMPLETED")}
                                  disabled={busyPurchaseId === purchase.id}
                                >
                                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                  Complete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void sendWebhook(purchase.id, "FAILED")}
                                  disabled={busyPurchaseId === purchase.id}
                                >
                                  <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                  Fail
                                </Button>
                              </>
                            ) : null}
                            {purchase.status === "FAILED" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void retryPurchase(purchase.id)}
                                disabled={busyPurchaseId === purchase.id}
                              >
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                Retry
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staging purchase tools</CardTitle>
          <CardDescription>
            Create a manual staging intent to validate completion, failure, retry, and activation email flows.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label>Candidate</Label>
            <Select
              value={selectedUserId || EMPTY_SELECT}
              onValueChange={(value) => setSelectedUserId(value === EMPTY_SELECT ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select candidate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT}>Select candidate</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.subscriptionId} value={user.userId}>
                    {user.name} · {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Plan</Label>
            <Select
              value={selectedPlanId || EMPTY_SELECT}
              onValueChange={(value) => setSelectedPlanId(value === EMPTY_SELECT ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT}>Select plan</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => void createIntent()} disabled={submitting}>
            <span className="inline-flex items-center justify-center gap-2">
              {submitting ? <InlineLoader label="Creating intent" size="sm" /> : "Create staging intent"}
            </span>
          </Button>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
