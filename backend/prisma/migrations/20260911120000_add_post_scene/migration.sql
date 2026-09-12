-- Stamp each post with a scene so Explore can rank local posts with one indexed
-- lookup instead of joining through the owner and the linked show.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "sceneId" TEXT;

-- CreateIndex
CREATE INDEX "Post_sceneId_createdAt_idx" ON "Post"("sceneId", "createdAt");

-- Backfill with the same rule POST /posts now applies: the linked show's scene
-- first, then the owning profile's.
UPDATE "Post" p
SET "sceneId" = COALESCE(
  (SELECT s."sceneId" FROM "Show"  s WHERE s."id" = p."showId"),
  (SELECT b."sceneId" FROM "Band"  b WHERE b."id" = p."ownerBandId"),
  (SELECT v."sceneId" FROM "Venue" v WHERE v."id" = p."ownerVenueId"),
  (SELECT u."sceneId" FROM "User"  u WHERE u."id" = p."ownerUserId")
)
WHERE p."sceneId" IS NULL;
