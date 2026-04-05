/*
  Warnings:

  - You are about to drop the column `endTime` on the `Show` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Show` table. All the data in the column will be lost.
  - Added the required column `doors` to the `Show` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Show" DROP COLUMN "endTime",
DROP COLUMN "startTime",
ADD COLUMN     "doors" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "ticketsUrl" TEXT;
