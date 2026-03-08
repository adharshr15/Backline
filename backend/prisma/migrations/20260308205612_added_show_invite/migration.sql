/*
  Warnings:

  - Added the required column `updatedAt` to the `VenueInvite` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VenueInvite" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "ShowInvite" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowInvite_showId_bandId_key" ON "ShowInvite"("showId", "bandId");
