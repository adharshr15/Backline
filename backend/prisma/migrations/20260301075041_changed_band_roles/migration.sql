/*
  Warnings:

  - The values [OWNER] on the enum `BandRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BandRole_new" AS ENUM ('MANAGER', 'MEMBER');
ALTER TABLE "public"."BandMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "BandMember" ALTER COLUMN "role" TYPE "BandRole_new" USING ("role"::text::"BandRole_new");
ALTER TYPE "BandRole" RENAME TO "BandRole_old";
ALTER TYPE "BandRole_new" RENAME TO "BandRole";
DROP TYPE "public"."BandRole_old";
ALTER TABLE "BandMember" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
COMMIT;
