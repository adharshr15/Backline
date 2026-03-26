/*
  Warnings:

  - Added the required column `participantType` to the `ConversationParticipant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('USER', 'BAND', 'VENUE');

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN     "participantType" "ParticipantType" NOT NULL;
