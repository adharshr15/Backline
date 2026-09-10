-- Drop the legacy Explore columns. Irreversible: the data is not recoverable.
--
-- Safe because every reader and writer now goes through the relations:
--   Band.genre              -> BandGenre (POST/PUT /bands write it since the
--                              previous commit; the backfill tagged older bands)
--   SceneFollow.city/state/ -> SceneFollow.scene (required since
--   country                    20260908201018; responses read the relation)
--   User.isPromoter         -> UserCraft (never written by any endpoint)

-- DropIndex
DROP INDEX "SceneFollow_city_state_idx";

-- AlterTable
ALTER TABLE "Band" DROP COLUMN "genre";

-- AlterTable
ALTER TABLE "SceneFollow" DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "state";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isPromoter";
