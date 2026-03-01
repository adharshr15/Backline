-- CreateTable
CREATE TABLE "_BandToTour" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BandToTour_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BandToTour_B_index" ON "_BandToTour"("B");
