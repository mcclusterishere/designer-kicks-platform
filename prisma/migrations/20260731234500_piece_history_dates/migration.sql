-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "commissionedAt" TIMESTAMP(3),
ADD COLUMN     "releasedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Submission_status_releasedAt_idx" ON "Submission"("status", "releasedAt");

