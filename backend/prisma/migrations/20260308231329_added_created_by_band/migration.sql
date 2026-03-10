/*
  Warnings:

  - Added the required column `createdByBandId` to the `Show` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Show" ADD COLUMN     "createdByBandId" TEXT NOT NULL;
