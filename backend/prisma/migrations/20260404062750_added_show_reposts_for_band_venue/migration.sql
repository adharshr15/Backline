-- CreateTable
CREATE TABLE "_showRepostedByBand" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_showRepostedByBand_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_showRepostedByVenue" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_showRepostedByVenue_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_showRepostedByBand_B_index" ON "_showRepostedByBand"("B");

-- CreateIndex
CREATE INDEX "_showRepostedByVenue_B_index" ON "_showRepostedByVenue"("B");
