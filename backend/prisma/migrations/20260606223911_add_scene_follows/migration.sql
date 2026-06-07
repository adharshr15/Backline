-- CreateTable
CREATE TABLE "SceneFollow" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT,
    "followerId" TEXT NOT NULL,
    "followerType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SceneFollow_city_state_idx" ON "SceneFollow"("city", "state");

-- CreateIndex
CREATE INDEX "SceneFollow_followerId_followerType_idx" ON "SceneFollow"("followerId", "followerType");

-- CreateIndex
CREATE UNIQUE INDEX "SceneFollow_followerId_followerType_city_state_key" ON "SceneFollow"("followerId", "followerType", "city", "state");
