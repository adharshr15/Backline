-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerUserId" TEXT,
    "followerBandId" TEXT,
    "followerVenueId" TEXT,
    "followerType" "AccountType" NOT NULL,
    "followeeUserId" TEXT,
    "followeeBandId" TEXT,
    "followeeVenueId" TEXT,
    "followeeType" "AccountType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Follow_followerUserId_idx" ON "Follow"("followerUserId");

-- CreateIndex
CREATE INDEX "Follow_followerBandId_idx" ON "Follow"("followerBandId");

-- CreateIndex
CREATE INDEX "Follow_followerVenueId_idx" ON "Follow"("followerVenueId");

-- CreateIndex
CREATE INDEX "Follow_followeeUserId_idx" ON "Follow"("followeeUserId");

-- CreateIndex
CREATE INDEX "Follow_followeeBandId_idx" ON "Follow"("followeeBandId");

-- CreateIndex
CREATE INDEX "Follow_followeeVenueId_idx" ON "Follow"("followeeVenueId");
