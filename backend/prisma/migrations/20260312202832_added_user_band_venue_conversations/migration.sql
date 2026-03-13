/*
  Warnings:

  - You are about to drop the column `senderId` on the `Message` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('USER_USER', 'USER_BAND', 'USER_VENUE', 'BAND_BAND', 'BAND_VENUE', 'VENUE_VENUE');

-- DropIndex
DROP INDEX "ConversationParticipant_userId_conversationId_key";

-- DropIndex
DROP INDEX "Message_senderId_idx";

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN     "bandId" TEXT,
ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "venueId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "senderId",
ADD COLUMN     "senderBandId" TEXT,
ADD COLUMN     "senderUserId" TEXT,
ADD COLUMN     "senderVenueId" TEXT;

-- CreateIndex
CREATE INDEX "ConversationParticipant_bandId_idx" ON "ConversationParticipant"("bandId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_venueId_idx" ON "ConversationParticipant"("venueId");
