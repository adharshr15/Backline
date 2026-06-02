-- CreateTable
CREATE TABLE "_showRsvpByBand" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_showRsvpByBand_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_showRsvpByUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_showRsvpByUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_showRsvpByVenue" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_showRsvpByVenue_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_showRsvpByBand_B_index" ON "_showRsvpByBand"("B");

-- CreateIndex
CREATE INDEX "_showRsvpByUser_B_index" ON "_showRsvpByUser"("B");

-- CreateIndex
CREATE INDEX "_showRsvpByVenue_B_index" ON "_showRsvpByVenue"("B");
