/*
  Warnings:

  - You are about to drop the `TourStop` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_BandTours` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Tour` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ShowStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShowRole" AS ENUM ('HEADLINER', 'SUPPORT');

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "TourStop";

-- DropTable
DROP TABLE "_BandTours";

-- DropEnum
DROP TYPE "StopStatus";

-- CreateTable
CREATE TABLE "BandTour" (
    "id" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,

    CONSTRAINT "BandTour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Show" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "city" TEXT NOT NULL,
    "status" "ShowStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "tourId" TEXT,
    "venueId" TEXT,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowBand" (
    "id" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "role" "ShowRole",

    CONSTRAINT "ShowBand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BandTour_bandId_tourId_key" ON "BandTour"("bandId", "tourId");

-- CreateIndex
CREATE INDEX "Show_tourId_idx" ON "Show"("tourId");

-- CreateIndex
CREATE INDEX "Show_venueId_idx" ON "Show"("venueId");

-- CreateIndex
CREATE INDEX "Show_city_idx" ON "Show"("city");

-- CreateIndex
CREATE INDEX "Show_date_idx" ON "Show"("date");

-- CreateIndex
CREATE INDEX "Show_status_idx" ON "Show"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ShowBand_bandId_showId_key" ON "ShowBand"("bandId", "showId");
