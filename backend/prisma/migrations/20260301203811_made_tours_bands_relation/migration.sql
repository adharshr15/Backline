/*
  Warnings:

  - You are about to drop the `_BandToTour` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "_BandToTour";

-- CreateTable
CREATE TABLE "_BandTours" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BandTours_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BandTours_B_index" ON "_BandTours"("B");
