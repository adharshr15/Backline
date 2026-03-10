-- DropIndex
DROP INDEX "BandInvite_bandId_userId_key";

-- DropIndex
DROP INDEX "TourInvite_tourId_bandId_key";

-- DropIndex
DROP INDEX "VenueInvite_userId_idx";

-- DropIndex
DROP INDEX "VenueInvite_venueId_idx";

-- DropIndex
DROP INDEX "VenueInvite_venueId_userId_key";

-- CreateIndex
CREATE INDEX "BandInvite_bandId_userId_idx" ON "BandInvite"("bandId", "userId");

-- CreateIndex
CREATE INDEX "TourInvite_tourId_bandId_idx" ON "TourInvite"("tourId", "bandId");

-- CreateIndex
CREATE INDEX "VenueInvite_venueId_userId_idx" ON "VenueInvite"("venueId", "userId");
