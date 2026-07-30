-- Align Subscription with schema.prisma (welcome email + custom portal URL)
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "welcomeEmailSentAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "customAccessUrl" TEXT;
