-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO');

-- CreateTable
CREATE TABLE "ShowMedia" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'PHOTO',
    "uploaderUserId" TEXT NOT NULL,
    "contributorType" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShowMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowMedia_showId_idx" ON "ShowMedia"("showId");
