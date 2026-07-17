-- AlterTable
ALTER TABLE "ArtistProfile" ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "collectorSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_collectorSlug_key" ON "User"("collectorSlug");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

