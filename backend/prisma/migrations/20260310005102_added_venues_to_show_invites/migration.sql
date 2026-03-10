-- DropIndex
DROP INDEX "ShowInvite_showId_bandId_key";

-- AlterTable
ALTER TABLE "ShowInvite" ADD COLUMN     "venueId" TEXT,
ALTER COLUMN "bandId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ShowInvite_showId_bandId_venueId_idx" ON "ShowInvite"("showId", "bandId", "venueId");
