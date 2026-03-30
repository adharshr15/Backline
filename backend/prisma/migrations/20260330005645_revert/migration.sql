/*
  Warnings:

  - You are about to drop the column `headerImageUrl` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `profileImageUrl` on the `User` table. All the data in the column will be lost.
  - Changed the type of `role` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "headerImageUrl",
DROP COLUMN "profileImageUrl",
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL;

-- DropEnum
DROP TYPE "AccountType";

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
