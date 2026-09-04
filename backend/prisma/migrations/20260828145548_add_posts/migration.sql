-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'PHOTO',
    "caption" TEXT,
    "uploaderUserId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerBandId" TEXT,
    "ownerVenueId" TEXT,
    "showId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "commenterUserId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorBandId" TEXT,
    "authorVenueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "likerType" TEXT NOT NULL,
    "likerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_ownerUserId_idx" ON "Post"("ownerUserId");

-- CreateIndex
CREATE INDEX "Post_ownerBandId_idx" ON "Post"("ownerBandId");

-- CreateIndex
CREATE INDEX "Post_ownerVenueId_idx" ON "Post"("ownerVenueId");

-- CreateIndex
CREATE INDEX "Post_showId_idx" ON "Post"("showId");

-- CreateIndex
CREATE INDEX "PostComment_postId_idx" ON "PostComment"("postId");

-- CreateIndex
CREATE INDEX "PostLike_postId_idx" ON "PostLike"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_likerType_likerId_key" ON "PostLike"("postId", "likerType", "likerId");
