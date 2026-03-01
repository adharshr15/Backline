/*
  Warnings:

  - You are about to drop the column `bandId` on the `Tour` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Tour_bandId_idx";

-- AlterTable
ALTER TABLE "Tour" DROP COLUMN "bandId";
