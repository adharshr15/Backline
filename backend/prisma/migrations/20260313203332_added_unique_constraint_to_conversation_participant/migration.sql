/*
  Warnings:

  - A unique constraint covering the columns `[conversationId,userId]` on the table `ConversationParticipant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[conversationId,bandId]` on the table `ConversationParticipant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[conversationId,venueId]` on the table `ConversationParticipant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_bandId_key" ON "ConversationParticipant"("conversationId", "bandId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_venueId_key" ON "ConversationParticipant"("conversationId", "venueId");
