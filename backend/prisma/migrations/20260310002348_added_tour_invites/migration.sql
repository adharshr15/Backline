-- CreateTable
CREATE TABLE "TourInvite" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TourInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TourInvite_tourId_bandId_key" ON "TourInvite"("tourId", "bandId");
