-- AlterTable
ALTER TABLE "Show" ADD COLUMN     "createdByUserId" TEXT,
ALTER COLUMN "createdByBandId" DROP NOT NULL;
