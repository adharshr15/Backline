-- Profiles (user, band or venue) vouching for a user in one of their crafts.
-- Keyed on (targetUserId, craft) rather than UserCraft.id, because
-- PUT /users/:id/crafts deletes and recreates every UserCraft row.

-- CreateTable
CREATE TABLE "CraftRecommendation" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "craft" "Craft" NOT NULL,
    "recommenderType" TEXT NOT NULL,
    "recommenderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CraftRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CraftRecommendation_targetUserId_craft_idx" ON "CraftRecommendation"("targetUserId", "craft");

-- CreateIndex
CREATE INDEX "CraftRecommendation_recommenderType_recommenderId_idx" ON "CraftRecommendation"("recommenderType", "recommenderId");

-- CreateIndex
CREATE UNIQUE INDEX "CraftRecommendation_target_craft_recommender_key" ON "CraftRecommendation"("targetUserId", "craft", "recommenderType", "recommenderId");
