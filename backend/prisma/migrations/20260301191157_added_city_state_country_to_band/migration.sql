/*
  Warnings:

  - You are about to drop the column `location` on the `Band` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Band" DROP COLUMN "location",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "state" TEXT;
