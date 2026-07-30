-- CreateTable
CREATE TABLE "CohortChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "slot" "CohortSessionSlot" NOT NULL,
    "authorName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CANDIDATE',
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CohortChatMessage_dayNumber_slot_createdAt_idx" ON "CohortChatMessage"("dayNumber", "slot", "createdAt");

-- CreateIndex
CREATE INDEX "CohortChatMessage_userId_idx" ON "CohortChatMessage"("userId");

-- AddForeignKey
ALTER TABLE "CohortChatMessage" ADD CONSTRAINT "CohortChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
