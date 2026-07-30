-- Ensure a user has at most one subscription record per plan
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_planId_key" UNIQUE ("userId", "planId");
