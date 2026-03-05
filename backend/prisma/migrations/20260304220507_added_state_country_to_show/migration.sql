/*
  Warnings:

  - Added the required column `country` to the `Show` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `Show` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Show" ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL;
