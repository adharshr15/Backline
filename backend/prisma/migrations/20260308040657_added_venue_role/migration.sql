-- CreateEnum
CREATE TYPE "VenueRole" AS ENUM ('MANAGER', 'REPRESENTATIVE');

-- AlterTable
ALTER TABLE "VenueRepresentative" ADD COLUMN     "role" "VenueRole" NOT NULL DEFAULT 'REPRESENTATIVE';
