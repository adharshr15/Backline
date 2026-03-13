-- CreateTable
CREATE TABLE "ConversationInvite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderBandId" TEXT,
    "senderVenueId" TEXT,
    "recipientUserId" TEXT,
    "recipientBandId" TEXT,
    "recipientVenueId" TEXT,
    "conversationId" TEXT,

    CONSTRAINT "ConversationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationInvite_senderUserId_idx" ON "ConversationInvite"("senderUserId");

-- CreateIndex
CREATE INDEX "ConversationInvite_senderBandId_idx" ON "ConversationInvite"("senderBandId");

-- CreateIndex
CREATE INDEX "ConversationInvite_senderVenueId_idx" ON "ConversationInvite"("senderVenueId");

-- CreateIndex
CREATE INDEX "ConversationInvite_recipientUserId_idx" ON "ConversationInvite"("recipientUserId");

-- CreateIndex
CREATE INDEX "ConversationInvite_recipientBandId_idx" ON "ConversationInvite"("recipientBandId");

-- CreateIndex
CREATE INDEX "ConversationInvite_recipientVenueId_idx" ON "ConversationInvite"("recipientVenueId");
