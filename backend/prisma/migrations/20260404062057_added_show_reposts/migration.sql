-- CreateTable
CREATE TABLE "_showRepostedByUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_showRepostedByUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_showRepostedByUser_B_index" ON "_showRepostedByUser"("B");
