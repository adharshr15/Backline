/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - Added the required column `accountType` to the `Band` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accountType` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accountType` to the `Venue` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('USER', 'BAND', 'VENUE');

-- DropIndex
DROP INDEX "User_role_idx";

-- AlterTable
ALTER TABLE "Band" ADD COLUMN     "accountType" "AccountType" NOT NULL,
ADD COLUMN     "headerImageUrl" TEXT,
ADD COLUMN     "profileImageUrl" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "accountType" "AccountType" NOT NULL,
ADD COLUMN     "headerImageUrl" TEXT,
ADD COLUMN     "profileImageUrl" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "accountType" "AccountType" NOT NULL,
ADD COLUMN     "headerImageUrl" TEXT,
ADD COLUMN     "profileImageUrl" TEXT;
