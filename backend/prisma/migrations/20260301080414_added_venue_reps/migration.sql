-- CreateTable
CREATE TABLE "VenueRepresentative" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,

    CONSTRAINT "VenueRepresentative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueRepresentative_venueId_idx" ON "VenueRepresentative"("venueId");

-- CreateIndex
CREATE INDEX "VenueRepresentative_userId_idx" ON "VenueRepresentative"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueRepresentative_userId_venueId_key" ON "VenueRepresentative"("userId", "venueId");
