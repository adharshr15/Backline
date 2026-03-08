-- CreateTable
CREATE TABLE "VenueInvite" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueInvite_venueId_idx" ON "VenueInvite"("venueId");

-- CreateIndex
CREATE INDEX "VenueInvite_userId_idx" ON "VenueInvite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueInvite_venueId_userId_key" ON "VenueInvite"("venueId", "userId");
