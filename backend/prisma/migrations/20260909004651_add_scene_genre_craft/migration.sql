-- CreateEnum
CREATE TYPE "Craft" AS ENUM ('PHOTOGRAPHER', 'VIDEOGRAPHER', 'PROMOTER', 'SOUND_ENGINEER', 'BOOKER', 'TOUR_MANAGER', 'STAGE_MANAGER', 'LIGHTING_TECH', 'DESIGNER', 'MERCH', 'JOURNALIST', 'DJ', 'LUTHIER', 'INSTRUCTOR');

-- AlterTable
ALTER TABLE "Band" ADD COLUMN     "sceneId" TEXT;

-- AlterTable
ALTER TABLE "SceneFollow" ADD COLUMN     "sceneId" TEXT;

-- AlterTable
ALTER TABLE "Show" ADD COLUMN     "sceneId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sceneId" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "sceneId" TEXT;

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'USA',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "bio" TEXT,
    "imageUrl" TEXT,
    "headerImageUrl" TEXT,
    "isCurated" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandGenre" (
    "id" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BandGenre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "craft" "Craft" NOT NULL,
    "forHire" BOOLEAN NOT NULL DEFAULT false,
    "headline" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scene_slug_key" ON "Scene"("slug");

-- CreateIndex
CREATE INDEX "Scene_city_state_idx" ON "Scene"("city", "state");

-- CreateIndex
CREATE INDEX "Scene_state_idx" ON "Scene"("state");

-- CreateIndex
CREATE INDEX "Scene_latitude_longitude_idx" ON "Scene"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Scene_parentId_idx" ON "Scene"("parentId");

-- CreateIndex
CREATE INDEX "Scene_isCurated_idx" ON "Scene"("isCurated");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE INDEX "Genre_parentId_idx" ON "Genre"("parentId");

-- CreateIndex
CREATE INDEX "Genre_isActive_sortOrder_idx" ON "Genre"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "BandGenre_bandId_idx" ON "BandGenre"("bandId");

-- CreateIndex
CREATE INDEX "BandGenre_genreId_idx" ON "BandGenre"("genreId");

-- CreateIndex
CREATE UNIQUE INDEX "BandGenre_bandId_genreId_key" ON "BandGenre"("bandId", "genreId");

-- CreateIndex
CREATE INDEX "UserCraft_userId_idx" ON "UserCraft"("userId");

-- CreateIndex
CREATE INDEX "UserCraft_craft_forHire_idx" ON "UserCraft"("craft", "forHire");

-- CreateIndex
CREATE UNIQUE INDEX "UserCraft_userId_craft_key" ON "UserCraft"("userId", "craft");

-- CreateIndex
CREATE INDEX "Band_sceneId_idx" ON "Band"("sceneId");

-- CreateIndex
CREATE INDEX "SceneFollow_sceneId_idx" ON "SceneFollow"("sceneId");

-- CreateIndex
CREATE INDEX "Show_sceneId_date_idx" ON "Show"("sceneId", "date");

-- CreateIndex
CREATE INDEX "User_sceneId_idx" ON "User"("sceneId");

-- CreateIndex
CREATE INDEX "Venue_sceneId_idx" ON "Venue"("sceneId");
