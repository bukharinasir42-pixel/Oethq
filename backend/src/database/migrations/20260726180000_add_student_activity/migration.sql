-- CreateTable
CREATE TABLE "StudentActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentActivity_dayKey_kind_idx" ON "StudentActivity"("dayKey", "kind");

-- CreateIndex
CREATE INDEX "StudentActivity_userId_dayKey_idx" ON "StudentActivity"("userId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentActivity_userId_dayKey_kind_key" ON "StudentActivity"("userId", "dayKey", "kind");
