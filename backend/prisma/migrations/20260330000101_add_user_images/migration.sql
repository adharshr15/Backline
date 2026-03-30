/*
  Warnings:

  - Changed the type of `role` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('USER', 'BAND', 'VENUE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "headerImageUrl" TEXT,
ADD COLUMN     "profileImageUrl" TEXT,
DROP COLUMN "role",
ADD COLUMN     "role" "AccountType" NOT NULL;

-- DropEnum
DROP TYPE "Role";

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
