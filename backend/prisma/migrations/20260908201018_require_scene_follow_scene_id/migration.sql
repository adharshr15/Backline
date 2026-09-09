-- Migration B of the Explore/Scenes rollout. This one TIGHTENS, so it is only
-- safe on a database where scripts/backfill-explore.ts has already run:
--
--   * SET NOT NULL fails if any SceneFollow row still has a null sceneId.
--   * The new unique index fails if two legacy rows with different city casings
--     (e.g. "Houston"/"TX" and "houston"/"tx") collapsed onto the same
--     (followerId, followerType, sceneId). The backfill's dedupe step handles this.
--
-- Verify both before deploying:
--   SELECT count(*) FROM "SceneFollow" WHERE "sceneId" IS NULL;                  -- must be 0
--   SELECT "followerId","followerType","sceneId", count(*) FROM "SceneFollow"
--     GROUP BY 1,2,3 HAVING count(*) > 1;                                        -- must be empty

-- DropIndex
DROP INDEX "SceneFollow_followerId_followerType_city_state_key";

-- AlterTable
ALTER TABLE "SceneFollow" ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "state" DROP NOT NULL,
ALTER COLUMN "sceneId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SceneFollow_followerId_followerType_sceneId_key" ON "SceneFollow"("followerId", "followerType", "sceneId");
